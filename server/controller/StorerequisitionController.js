import mongoose from 'mongoose';
import StoreRequisition from '../module/StoreRequisition.js';
import ClinicInventory from '../module/ClinicInventory.js';
import QueueCounter from '../module/QueueCounter.js';
import DispensaryInventoryTransaction from '../module/DispensaryInventoryTransaction.js';
import { writeAuditEvent } from '../utils/auditLogger.js';

const isNonEmptyString = (value, maxLength) => (
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
);

const parseExpiryDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
};

const nextRequisitionSequence = async (year) => {
  const key = `store-requisition-${year}`;
  try {
    const counter = await QueueCounter.findOneAndUpdate(
      { _id: key },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return counter.sequence;
  } catch (error) {
    if (error.code === 11000) {
      const counter = await QueueCounter.findOneAndUpdate(
        { _id: key },
        { $inc: { sequence: 1 } },
        { new: true },
      ).lean();
      if (counter) return counter.sequence;
    }
    throw error;
  }
};

const calculateStatus = (requisition) => {
  const lines = requisition.items || [];
  const allApprovedReceived = lines.length && lines.every((item) => (
    Number(item.receivedQty) >= Number(item.approvedQty)
  ));
  const allRequestedApproved = lines.every((item) => (
    Number(item.approvedQty) === 0 || Number(item.approvedQty) >= Number(item.requestedQty)
  ));
  if (allApprovedReceived && allRequestedApproved) {
    return 'Received';
  }
  if (lines.some((item) => Number(item.receivedQty) > 0)) return 'Partially Received';
  if (lines.some((item) => Number(item.issuedQty) > 0)) {
    return lines.every((item) => (
      Number(item.issuedQty) >= Number(item.approvedQty)
      && (Number(item.approvedQty) === 0 || Number(item.approvedQty) >= Number(item.requestedQty))
    ))
      ? 'Issued (Model 22)'
      : 'Partially Issued';
  }
  return 'Approved';
};

const transactionFailure = (res, error, action) => {
  console.error(`Failed to ${action}:`, error);
  if (error.name === 'VersionError') {
    return res.status(409).json({ success: false, message: 'This requisition changed in another session. Refresh and retry.' });
  }
  if (error.codeName === 'IllegalOperation' && /transaction/i.test(error.message || '')) {
    return res.status(503).json({
      success: false,
      message: 'Safe inventory receipt requires MongoDB replica set or mongos transaction support; no stock was changed.',
    });
  }
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : `Unable to ${action}.`,
  });
};

const recordWorkflowAudit = async (event) => {
  try {
    await writeAuditEvent(event);
    return '';
  } catch (error) {
    console.error('Store requisition was saved but its audit event failed:', error);
    return ' The change was saved, but its audit event could not be recorded; notify an administrator.';
  }
};

export const createRequisition = async (req, res) => {
  const { reason, items } = req.body || {};
  const requestedBy = String(req.user?.name || '').trim();
  if (
    !requestedBy
    || !isNonEmptyString(reason, 120)
    || !Array.isArray(items)
    || items.length < 1
    || items.length > 100
    || items.some((item) => (
      !item
      || !isNonEmptyString(item.itemCode, 80)
      || !isNonEmptyString(item.itemDescription, 200)
      || !isNonEmptyString(item.uom, 40)
      || (item.itemCategory && !isNonEmptyString(item.itemCategory, 120))
      || !Number.isFinite(item.requestedQty)
      || item.requestedQty <= 0
    ))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Provide a requisition reason and at least one valid item with code, description, UOM, and positive quantity.',
    });
  }

  try {
    const year = new Date().getFullYear();
    let sequence = await nextRequisitionSequence(year);
    let requisitionNo = `REQ-${year}-${String(sequence).padStart(3, '0')}`;
    while (await StoreRequisition.exists({ requisitionNo })) {
      sequence = await nextRequisitionSequence(year);
      requisitionNo = `REQ-${year}-${String(sequence).padStart(3, '0')}`;
    }
    const requisition = await StoreRequisition.create({
      requisitionNo,
      requestedBy,
      reason: reason.trim(),
      items: items.map((item) => ({
        itemCode: item.itemCode.trim(),
        itemDescription: item.itemDescription.trim(),
        uom: item.uom.trim(),
        itemCategory: isNonEmptyString(item.itemCategory, 120) ? item.itemCategory.trim() : 'Medical Supplies',
        requestedQty: item.requestedQty,
      })),
    });
    const auditWarning = await recordWorkflowAudit({
      req,
      action: 'STORE_REQUISITION_CREATE',
      entityType: 'store_requisition',
      entityId: requisition._id,
      details: `Submitted ${requisition.requisitionNo} with ${items.length} requested item(s).`,
    });
    return res.status(201).json({
      success: true,
      message: `Store requisition submitted successfully.${auditWarning}`,
      data: requisition,
    });
  } catch (error) {
    console.error('Failed to create store requisition:', error);
    return res.status(500).json({ success: false, message: 'Unable to submit store requisition.' });
  }
};

export const getRequisitions = async (req, res) => {
  try {
    const requisitions = await StoreRequisition.find()
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    return res.status(200).json({ success: true, data: requisitions });
  } catch (error) {
    console.error('Failed to load store requisitions:', error);
    return res.status(500).json({ success: false, message: 'Unable to load store requisitions.' });
  }
};

export const decideRequisition = async (req, res) => {
  const { id } = req.params;
  const { decision, approvalRemark = '', items = [] } = req.body || {};
  if (
    !mongoose.isValidObjectId(id)
    || !['approve', 'reject'].includes(decision)
    || (approvalRemark && !isNonEmptyString(approvalRemark, 500))
  ) {
    return res.status(400).json({ success: false, message: 'Provide a valid requisition, decision, and optional remark.' });
  }

  try {
    const requisition = await StoreRequisition.findById(id);
    if (!requisition) return res.status(404).json({ success: false, message: 'Requisition not found.' });
    const canApprove = ['Pending Approval', 'Partially Issued', 'Partially Received'].includes(requisition.status);
    if (!canApprove || (decision === 'reject' && requisition.status !== 'Pending Approval')) {
      return res.status(409).json({ success: false, message: 'This requisition is not available for the selected approval decision.' });
    }

    if (decision === 'reject') {
      if (!isNonEmptyString(approvalRemark, 500)) {
        return res.status(400).json({ success: false, message: 'Enter a reason when rejecting a requisition.' });
      }
      requisition.status = 'Rejected';
      requisition.approvalRemark = approvalRemark.trim();
    } else {
      if (!Array.isArray(items) || items.length !== requisition.items.length) {
        return res.status(400).json({ success: false, message: 'Provide an approved quantity for every requested item.' });
      }
      const approvedById = new Map(items.map((item) => [String(item.requisitionItemId || ''), item.approvedQty]));
      if (requisition.items.some((item) => {
        const quantity = approvedById.get(String(item._id));
        return !Number.isFinite(quantity) || quantity < item.issuedQty || quantity > item.requestedQty;
      }) || !requisition.items.some((item) => approvedById.get(String(item._id)) > item.issuedQty)) {
        return res.status(400).json({ success: false, message: 'Approved quantities cannot be below already-issued amounts or exceed requested amounts; at least one amount must remain approved.' });
      }
      requisition.items.forEach((item) => {
        item.approvedQty = approvedById.get(String(item._id));
      });
      requisition.status = requisition.items.some((item) => Number(item.issuedQty) > 0)
        ? calculateStatus(requisition)
        : 'Approved';
      requisition.approvalRemark = String(approvalRemark || '').trim();
    }
    requisition.approvedBy = String(req.user?.name || '').trim();
    requisition.approvedAt = new Date();
    await requisition.save();
    const auditWarning = await recordWorkflowAudit({
      req,
      action: decision === 'approve' ? 'STORE_REQUISITION_APPROVE' : 'STORE_REQUISITION_REJECT',
      entityType: 'store_requisition',
      entityId: requisition._id,
      details: `${decision === 'approve' ? 'Approved' : 'Rejected'} ${requisition.requisitionNo}.`,
    });
    return res.status(200).json({ success: true, message: `Requisition ${decision}d.${auditWarning}`, data: requisition });
  } catch (error) {
    console.error('Failed to decide store requisition:', error);
    if (error.name === 'VersionError') {
      return res.status(409).json({ success: false, message: 'This requisition changed in another session. Refresh and retry.' });
    }
    return res.status(500).json({ success: false, message: 'Unable to update store requisition approval.' });
  }
};

export const issueRequisition = async (req, res) => {
  const { id } = req.params;
  const { model22Reference, items } = req.body || {};
  if (
    !mongoose.isValidObjectId(id)
    || !isNonEmptyString(model22Reference, 100)
    || !Array.isArray(items)
    || !items.length
  ) {
    return res.status(400).json({ success: false, message: 'Provide the Model 22 number and issued quantities.' });
  }

  try {
    const requisition = await StoreRequisition.findById(id);
    if (!requisition) return res.status(404).json({ success: false, message: 'Requisition not found.' });
    if (!['Approved', 'Partially Issued', 'Partially Received', 'Issued', 'Issued (Model 22)'].includes(requisition.status)) {
      return res.status(409).json({ success: false, message: 'This requisition is not approved for issue.' });
    }
    const issueById = new Map();
    for (const item of items) {
      const key = String(item?.requisitionItemId || '');
      if (!mongoose.isValidObjectId(key) || issueById.has(key) || !Number.isFinite(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Each issue line must have a unique requisition item and positive quantity.' });
      }
      issueById.set(key, item.quantity);
    }
    const issueLines = [];
    for (const item of requisition.items) {
      const quantity = issueById.get(String(item._id)) || 0;
      if (quantity > item.approvedQty - item.issuedQty) {
        return res.status(409).json({ success: false, message: `Issue quantity exceeds the approved remaining quantity for ${item.itemDescription}.` });
      }
      if (quantity > 0) issueLines.push({ requisitionItemId: item._id, quantity });
    }
    if (!issueLines.length || issueById.size !== issueLines.length) {
      return res.status(400).json({ success: false, message: 'Include at least one valid quantity for a requested item.' });
    }

    issueLines.forEach(({ requisitionItemId, quantity }) => {
      const item = requisition.items.id(requisitionItemId);
      item.issuedQty += quantity;
    });
    const issueDate = new Date();
    requisition.model22Reference = model22Reference.trim();
    requisition.model22Issues.push({
      model22Reference: model22Reference.trim(),
      issuedAt: issueDate,
      issuedBy: String(req.user?.name || '').trim(),
      items: issueLines,
    });
    requisition.issuedAt = issueDate;
    requisition.status = calculateStatus(requisition);
    await requisition.save();
    const auditWarning = await recordWorkflowAudit({
      req,
      action: 'STORE_REQUISITION_MODEL22_ISSUE',
      entityType: 'store_requisition',
      entityId: requisition._id,
      details: `Recorded Model 22 ${model22Reference.trim()} for ${requisition.requisitionNo}.`,
    });
    return res.status(200).json({ success: true, message: `Model 22 issue recorded.${auditWarning}`, data: requisition });
  } catch (error) {
    console.error('Failed to issue store requisition:', error);
    if (error.name === 'VersionError') {
      return res.status(409).json({ success: false, message: 'This requisition changed in another session. Refresh and retry.' });
    }
    return res.status(500).json({ success: false, message: 'Unable to record Model 22 issue.' });
  }
};

export const receiveRequisition = async (req, res) => {
  const { id } = req.params;
  const { items, model22Reference = '' } = req.body || {};
  if (
    !mongoose.isValidObjectId(id)
    || !Array.isArray(items)
    || !items.length
    || (model22Reference && !isNonEmptyString(model22Reference, 100))
    || items.some((item) => (
      !item
      || !mongoose.isValidObjectId(item.requisitionItemId)
      || !Number.isFinite(item.quantity)
      || item.quantity <= 0
      || !isNonEmptyString(item.batchNumber, 100)
      || (item.serialNumber && !isNonEmptyString(item.serialNumber, 100))
      || !parseExpiryDate(item.expiryDate)
      || !Number.isFinite(item.unitPrice)
      || item.unitPrice < 0
    ))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Provide received quantities, batch numbers, valid expiry dates, and non-negative unit prices for each line.',
    });
  }

  const session = await mongoose.startSession();
  let savedRequisition;
  let savedTransaction;
  try {
    await session.withTransaction(async () => {
      const requisition = await StoreRequisition.findById(id).session(session);
      if (!requisition) {
        const notFound = new Error('Requisition not found.');
        notFound.statusCode = 404;
        throw notFound;
      }
      if (!['Partially Issued', 'Issued', 'Issued (Model 22)', 'Partially Received'].includes(requisition.status)) {
        const conflict = new Error('Only items recorded as issued on a Model 22 can be received.');
        conflict.statusCode = 409;
        throw conflict;
      }

      const seenLines = new Set();
      const receiptLines = [];
      for (const receivedLine of items) {
        const lineId = String(receivedLine.requisitionItemId);
        if (seenLines.has(lineId)) {
          const invalid = new Error('A requisition line can only appear once per receipt.');
          invalid.statusCode = 400;
          throw invalid;
        }
        seenLines.add(lineId);
        const requestLine = requisition.items.id(lineId);
        if (!requestLine || receivedLine.quantity > requestLine.issuedQty - requestLine.receivedQty) {
          const conflict = new Error(`Received quantity exceeds the outstanding issued quantity for ${requestLine?.itemDescription || 'an item'}.`);
          conflict.statusCode = 409;
          throw conflict;
        }
        const expiryDate = parseExpiryDate(receivedLine.expiryDate);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (!expiryDate || expiryDate < today) {
          const invalid = new Error(`Enter an unexpired batch expiry date for ${requestLine.itemDescription}.`);
          invalid.statusCode = 400;
          throw invalid;
        }

        const escapedCode = requestLine.itemCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let inventoryItem = await ClinicInventory.findOne({
          itemCode: { $regex: `^${escapedCode}$`, $options: 'i' },
        }).session(session);
        if (inventoryItem && (
          inventoryItem.itemName.trim().toLocaleLowerCase() !== requestLine.itemDescription.trim().toLocaleLowerCase()
          || inventoryItem.unit.trim().toLocaleLowerCase() !== requestLine.uom.trim().toLocaleLowerCase()
        )) {
          const conflict = new Error(`Inventory code ${requestLine.itemCode} belongs to a different item or unit.`);
          conflict.statusCode = 409;
          throw conflict;
        }
        if (!inventoryItem) {
          inventoryItem = new ClinicInventory({
            itemName: requestLine.itemDescription,
            itemCode: requestLine.itemCode,
            category: requestLine.itemCategory || 'Medical Supplies',
            storageLocation: 'Clinical Pharmacy',
            quantity: 0,
            reorderLevel: 0,
            unit: requestLine.uom,
            batches: [],
          });
        }

        const batchNumber = receivedLine.batchNumber.trim();
        const existingBatch = inventoryItem.batches.find((batch) => (
          batch.batchNumber.trim().toLocaleLowerCase() === batchNumber.toLocaleLowerCase()
        ));
        if (existingBatch) {
          if (
            !existingBatch.expiryDate
            || new Date(existingBatch.expiryDate).toISOString().slice(0, 10) !== receivedLine.expiryDate
            || Number(existingBatch.unitPrice) !== receivedLine.unitPrice
          ) {
            const conflict = new Error(`Batch ${batchNumber} already exists with different expiry or price details.`);
            conflict.statusCode = 409;
            throw conflict;
          }
          existingBatch.quantity += receivedLine.quantity;
          if (receivedLine.serialNumber) existingBatch.serialNumber = receivedLine.serialNumber.trim();
        } else {
          inventoryItem.batches.push({
            batchNumber,
            serialNumber: String(receivedLine.serialNumber || '').trim(),
            quantity: receivedLine.quantity,
            unitPrice: receivedLine.unitPrice,
            expiryDate,
          });
        }
        inventoryItem.quantity += receivedLine.quantity;
        inventoryItem.itemName = requestLine.itemDescription;
        inventoryItem.itemCode = requestLine.itemCode;
        inventoryItem.category = requestLine.itemCategory || inventoryItem.category || 'Medical Supplies';
        inventoryItem.storageLocation = 'Clinical Pharmacy';
        inventoryItem.unit = requestLine.uom;
        inventoryItem.expiryDate = inventoryItem.batches
          .filter((batch) => Number(batch.quantity) > 0 && batch.expiryDate)
          .sort((left, right) => new Date(left.expiryDate) - new Date(right.expiryDate))[0]?.expiryDate || expiryDate;
        await inventoryItem.save({ session });

        requestLine.receivedQty += receivedLine.quantity;
        requestLine.receipts.push({
          quantity: receivedLine.quantity,
          batchNumber,
          serialNumber: String(receivedLine.serialNumber || '').trim(),
          expiryDate,
          unitPrice: receivedLine.unitPrice,
          receivedAt: new Date(),
          receivedBy: String(req.user?.name || '').trim(),
        });
        receiptLines.push({
          inventoryItemId: inventoryItem._id,
          itemCode: inventoryItem.itemCode,
          itemDescription: inventoryItem.itemName,
          uom: inventoryItem.unit,
          subInventory: inventoryItem.storageLocation,
          itemCategory: inventoryItem.category,
          batchNumber,
          serialNumber: String(receivedLine.serialNumber || '').trim(),
          quantity: receivedLine.quantity,
          unitPrice: receivedLine.unitPrice,
          totalAmount: receivedLine.quantity * receivedLine.unitPrice,
          expiryDate,
          remark: `Received against ${requisition.requisitionNo}`,
        });
      }

      requisition.status = calculateStatus(requisition);
      requisition.receivedBy = String(req.user?.name || '').trim();
      requisition.receivedAt = new Date();
      await requisition.save({ session });
      [savedTransaction] = await DispensaryInventoryTransaction.create([{
        modelNumber: model22Reference.trim() || requisition.model22Reference || requisition.requisitionNo,
        modelType: 'Model 22',
        transactionType: 'Store Requisition Receipt',
        source: 'MAU Main Medical Store',
        destination: 'Clinical Pharmacy',
        performedBy: String(req.user?.name || '').trim(),
        items: receiptLines,
      }], { session });
      savedRequisition = requisition;
    });
    const auditWarning = await recordWorkflowAudit({
      req,
      action: 'STORE_REQUISITION_RECEIVE',
      entityType: 'store_requisition',
      entityId: savedRequisition._id,
      details: `Confirmed receipt for ${savedRequisition.requisitionNo}; dispensary inventory updated.`,
    });
    return res.status(200).json({
      success: true,
      message: `${savedRequisition.status === 'Received'
        ? 'Receipt confirmed. Requisition completed and dispensary stock updated.'
        : 'Partial receipt confirmed. Dispensary stock updated.'}${auditWarning}`,
      data: savedRequisition,
      transaction: savedTransaction,
    });
  } catch (error) {
    return transactionFailure(res, error, 'confirm store requisition receipt');
  } finally {
    await session.endSession();
  }
};
