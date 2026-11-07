import mongoose from 'mongoose';
import ClinicInventory from '../module/ClinicInventory.js';
import ClinicOperationalSettings from '../module/ClinicOperationalSettings.js';
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

const transactionFailure = (res, error, action) => {
  console.error(`Failed to ${action}:`, error);
  if (error.codeName === 'IllegalOperation' && /transaction/i.test(error.message || '')) {
    return res.status(503).json({
      success: false,
      message: 'Safe inventory transactions require MongoDB replica set or mongos transaction support; no stock was changed.',
    });
  }
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : `Unable to ${action}.`,
  });
};

export const getDispensaryStock = async (req, res) => {
  try {
    const [items, settings] = await Promise.all([
      ClinicInventory.find().sort({ itemName: 1 }).lean(),
      ClinicOperationalSettings.findOne({ key: 'clinic' }).select('inventoryRules').lean(),
    ]);
    const defaultThreshold = settings?.inventoryRules?.defaultThreshold ?? 20;
    const expiryWarningDays = settings?.inventoryRules?.expiryWarningDays || 90;
    const categoryThresholds = new Map((settings?.inventoryRules?.categoryThresholds || [])
      .map(({ category, threshold }) => [String(category).trim().toLocaleLowerCase(), threshold]));
    const data = items.map((item) => {
      const batches = Array.isArray(item.batches) ? item.batches : [];
      const now = new Date();
      const expiryWarningDate = new Date(now.getTime() + expiryWarningDays * 24 * 60 * 60 * 1000);
      const stockBatches = batches.map((batch) => ({
        ...batch,
        expired: Boolean(batch.expiryDate && new Date(batch.expiryDate) < now),
        expiringSoon: Boolean(batch.expiryDate
          && new Date(batch.expiryDate) >= now
          && new Date(batch.expiryDate) <= expiryWarningDate),
      }));
      const usableBatches = stockBatches.filter((batch) => (
        Number(batch.quantity) > 0
        && String(batch.batchNumber || '').trim()
        && batch.expiryDate
        && !batch.expired
      ));
      const availableQuantity = Math.min(
        usableBatches.reduce((sum, batch) => sum + Number(batch.quantity), 0),
        Number(item.quantity) || 0,
      );
      const categoryThreshold = categoryThresholds.get(String(item.category || '').trim().toLocaleLowerCase());
      const reorderLevel = categoryThreshold ?? defaultThreshold ?? Number(item.reorderLevel);
      const expiryEntries = stockBatches.filter((batch) => Number(batch.quantity) > 0 && batch.expiryDate);
      const expired = expiryEntries.some((batch) => batch.expired);
      const expiringSoon = expiryEntries.some((batch) => batch.expiringSoon);
      return {
        ...item,
        batches: stockBatches,
        availableQuantity,
        effectiveReorderLevel: reorderLevel,
        computedStatus: availableQuantity <= 0
          ? 'out_of_stock'
          : availableQuantity <= reorderLevel ? 'low_stock' : 'in_stock',
        expired,
        expiringSoon,
      };
    });
    return res.status(200).json({
      success: true,
      count: data.length,
      expiryWarningDays,
      data,
    });
  } catch (error) {
    console.error('Failed to load dispensary stock list:', error);
    return res.status(500).json({ success: false, message: 'Unable to load dispensary stock list.' });
  }
};

export const receiveDispensaryStock = async (req, res) => {
  const {
    itemCode = '',
    itemDescription,
    uom,
    subInventory = 'Clinical Pharmacy',
    itemCategory,
    batchNumber,
    serialNumber = '',
    quantity,
    unitPrice,
    expiryDate: expiryDateInput,
    modelNumber,
    transactionType = 'PO Receipt',
    source,
    poNumber = '',
    buyer = '',
    sequenceFrom = '',
    sequenceTo = '',
    remark = '',
  } = req.body || {};
  const expiryDate = parseExpiryDate(expiryDateInput);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (
    !isNonEmptyString(itemDescription, 200)
    || !isNonEmptyString(itemCode, 80)
    || !isNonEmptyString(uom, 40)
    || !isNonEmptyString(itemCategory, 120)
    || !isNonEmptyString(batchNumber, 100)
    || (serialNumber && !isNonEmptyString(serialNumber, 100))
    || !Number.isFinite(quantity) || quantity <= 0
    || !Number.isFinite(unitPrice) || unitPrice < 0
    || !expiryDate
    || expiryDate < today
    || !isNonEmptyString(modelNumber, 80)
    || !isNonEmptyString(transactionType, 100)
    || !isNonEmptyString(source, 160)
    || (subInventory && !isNonEmptyString(subInventory, 120))
    || (poNumber && !isNonEmptyString(poNumber, 100))
    || (buyer && !isNonEmptyString(buyer, 160))
    || (sequenceFrom && !isNonEmptyString(sequenceFrom, 80))
    || (sequenceTo && !isNonEmptyString(sequenceTo, 80))
    || (remark && !isNonEmptyString(remark, 250))
  ) {
    return res.status(400).json({ success: false, message: 'Complete the required Model 19 item, batch, quantity, price, expiry, model, transaction type, and source fields with valid values.' });
  }

  const session = await mongoose.startSession();
  let savedTransaction;
  try {
    await session.withTransaction(async () => {
      let item = itemCode
        ? await ClinicInventory.findOne({ itemCode: itemCode.trim() }).session(session)
        : null;
      if (!item) {
        item = await ClinicInventory.findOne({
          itemName: { $regex: `^${itemDescription.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        }).session(session);
      }

      if (!item) {
        item = new ClinicInventory({
          itemName: itemDescription.trim(),
          itemCode: itemCode.trim(),
          category: itemCategory.trim(),
          storageLocation: subInventory.trim(),
          quantity: 0,
          reorderLevel: 0,
          unit: uom.trim(),
          batches: [],
        });
      } else if (
        item.itemName.trim().toLocaleLowerCase() !== itemDescription.trim().toLocaleLowerCase()
        || (item.itemCode && item.itemCode.trim().toLocaleLowerCase() !== itemCode.trim().toLocaleLowerCase())
      ) {
        const error = new Error('The selected item code already belongs to a different inventory item.');
        error.statusCode = 409;
        throw error;
      }

      const receivedBatch = item.batches.find((batch) => (
        batch.batchNumber.trim().toLocaleLowerCase() === batchNumber.trim().toLocaleLowerCase()
      ));
      if (receivedBatch) {
        receivedBatch.quantity += quantity;
        receivedBatch.unitPrice = unitPrice;
        receivedBatch.expiryDate = expiryDate;
        if (serialNumber) receivedBatch.serialNumber = serialNumber.trim();
      } else {
        item.batches.push({
          batchNumber: batchNumber.trim(),
          serialNumber: serialNumber.trim(),
          quantity,
          unitPrice,
          expiryDate,
        });
      }
      item.quantity += quantity;
      item.itemName = itemDescription.trim();
      item.itemCode = itemCode.trim() || item.itemCode;
      item.category = itemCategory.trim();
      item.storageLocation = subInventory.trim();
      item.unit = uom.trim();
      item.expiryDate = item.batches
        .filter((batch) => Number(batch.quantity) > 0 && batch.expiryDate)
        .sort((left, right) => new Date(left.expiryDate) - new Date(right.expiryDate))[0]?.expiryDate || expiryDate;
      await item.save({ session });

      [savedTransaction] = await DispensaryInventoryTransaction.create([{
        modelNumber: modelNumber.trim(),
        modelType: 'Model 19',
        transactionType: transactionType.trim(),
        source: source.trim(),
        poNumber: poNumber.trim(),
        buyer: buyer.trim(),
        performedBy: String(req.user?.name || '').trim(),
        items: [{
          inventoryItemId: item._id,
          itemCode: item.itemCode,
          itemDescription: item.itemName,
          uom: item.unit,
          subInventory: item.storageLocation,
          itemCategory: item.category,
          batchNumber: batchNumber.trim(),
          serialNumber: serialNumber.trim(),
          quantity,
          unitPrice,
          totalAmount: quantity * unitPrice,
          expiryDate,
          sequenceFrom: sequenceFrom.trim(),
          sequenceTo: sequenceTo.trim(),
          remark: remark.trim(),
        }],
      }], { session });
    });
    await writeAuditEvent({
      req,
      action: 'DISPENSARY_MODEL19_RECEIPT',
      entityType: 'dispensary_inventory_transaction',
      entityId: savedTransaction._id,
      details: `Received ${quantity} ${uom} of ${itemDescription} under Model 19 ${modelNumber}.`,
    });
    req.app.get('io')?.emit('clinic:inventory-updated');
    return res.status(201).json({ success: true, message: 'Stock received and Model 19 transaction recorded.', data: savedTransaction });
  } catch (error) {
    return transactionFailure(res, error, 'receive stock');
  } finally {
    await session.endSession();
  }
};

export const issueDispensaryStock = async (req, res) => {
  const { id } = req.params;
  const {
    quantity,
    batchNumber = '',
    serialNumber = '',
    modelNumber,
    transactionType = 'Move Order Issue',
    destination,
    sequenceFrom = '',
    sequenceTo = '',
    remark = '',
  } = req.body || {};
  if (
    !mongoose.isValidObjectId(id)
    || !Number.isFinite(quantity) || quantity <= 0
    || (batchNumber && !isNonEmptyString(batchNumber, 100))
    || (serialNumber && !isNonEmptyString(serialNumber, 100))
    || !isNonEmptyString(modelNumber, 80)
    || !isNonEmptyString(transactionType, 100)
    || !isNonEmptyString(destination, 160)
    || (sequenceFrom && !isNonEmptyString(sequenceFrom, 80))
    || (sequenceTo && !isNonEmptyString(sequenceTo, 80))
    || (remark && !isNonEmptyString(remark, 250))
  ) {
    return res.status(400).json({ success: false, message: 'Provide a valid item, quantity, Model 22 number, transaction type, and destination.' });
  }

  const session = await mongoose.startSession();
  let savedTransaction;
  try {
    await session.withTransaction(async () => {
      const item = await ClinicInventory.findById(id).session(session);
      if (!item) {
        const error = new Error('Inventory item not found.');
        error.statusCode = 404;
        throw error;
      }
      if (item.quantity < quantity) {
        const error = new Error(`Insufficient stock. Only ${item.quantity} ${item.unit} remain.`);
        error.statusCode = 409;
        throw error;
      }

      const now = new Date();
      const batches = [...(item.batches || [])]
        .filter((batch) => Number(batch.quantity) > 0 && batch.expiryDate && new Date(batch.expiryDate) >= now
          && (!batchNumber || batch.batchNumber.trim().toLocaleLowerCase() === batchNumber.trim().toLocaleLowerCase()))
        .sort((left, right) => new Date(left.expiryDate) - new Date(right.expiryDate));
      const totalBatchStock = batches.reduce((sum, batch) => sum + Number(batch.quantity), 0);
      const hasTrackedBatches = item.batches?.some((batch) => Number(batch.quantity) > 0);
      if (batchNumber && !batches.length) {
        const error = new Error('The selected batch is unavailable or expired.');
        error.statusCode = 409;
        throw error;
      }
      if (hasTrackedBatches && !batchNumber && totalBatchStock < quantity) {
        const error = new Error(`Insufficient unexpired batch stock. Only ${totalBatchStock} ${item.unit} can be issued.`);
        error.statusCode = 409;
        throw error;
      }

      let remaining = quantity;
      const issuedLines = [];
      if (batches.length) {
        for (const batch of batches) {
          if (remaining <= 0) break;
          const issued = Math.min(Number(batch.quantity), remaining);
          batch.quantity -= issued;
          remaining -= issued;
          issuedLines.push({
            inventoryItemId: item._id,
            itemCode: item.itemCode,
            itemDescription: item.itemName,
            uom: item.unit,
            subInventory: item.storageLocation,
            itemCategory: item.category,
            batchNumber: batch.batchNumber,
            serialNumber: serialNumber.trim() || batch.serialNumber,
            quantity: issued,
            unitPrice: Number(batch.unitPrice) || 0,
            totalAmount: issued * (Number(batch.unitPrice) || 0),
            expiryDate: batch.expiryDate,
            sequenceFrom: sequenceFrom.trim(),
            sequenceTo: sequenceTo.trim(),
            remark: remark.trim(),
          });
        }
        if (remaining > 0) {
          const error = new Error('Insufficient stock in the selected or unexpired batches.');
          error.statusCode = 409;
          throw error;
        }
      } else {
        issuedLines.push({
          inventoryItemId: item._id,
          itemCode: item.itemCode,
          itemDescription: item.itemName,
          uom: item.unit,
          subInventory: item.storageLocation,
          itemCategory: item.category,
          batchNumber: '',
          serialNumber: serialNumber.trim(),
          quantity,
          unitPrice: 0,
          totalAmount: 0,
          expiryDate: item.expiryDate,
          sequenceFrom: sequenceFrom.trim(),
          sequenceTo: sequenceTo.trim(),
          remark: remark.trim(),
        });
      }

      item.quantity -= quantity;
      if (item.batches?.length) {
        item.batches = item.batches.map((batch) => (
          batches.find((selected) => String(selected._id) === String(batch._id)) || batch
        ));
        item.expiryDate = item.batches
          .filter((batch) => Number(batch.quantity) > 0 && batch.expiryDate && new Date(batch.expiryDate) >= now)
          .sort((left, right) => new Date(left.expiryDate) - new Date(right.expiryDate))[0]?.expiryDate || null;
      }
      await item.save({ session });

      [savedTransaction] = await DispensaryInventoryTransaction.create([{
        modelNumber: modelNumber.trim(),
        modelType: 'Model 22',
        transactionType: transactionType.trim(),
        destination: destination.trim(),
        performedBy: String(req.user?.name || '').trim(),
        items: issuedLines,
      }], { session });
    });
    await writeAuditEvent({
      req,
      action: 'DISPENSARY_MODEL22_ISSUE',
      entityType: 'dispensary_inventory_transaction',
      entityId: savedTransaction._id,
      details: `Issued ${quantity} ${itemUnitFrom(savedTransaction)} under Model 22 ${modelNumber} to ${destination}.`,
    });
    req.app.get('io')?.emit('clinic:inventory-updated');
    return res.status(200).json({ success: true, message: 'Stock issued and Model 22 transaction recorded.', data: savedTransaction });
  } catch (error) {
    return transactionFailure(res, error, 'issue stock');
  } finally {
    await session.endSession();
  }
};

const itemUnitFrom = (transaction) => transaction.items?.[0]?.uom || 'units';

export const getDispensaryInventoryTransactions = async (req, res) => {
  const modelType = typeof req.query.modelType === 'string' ? req.query.modelType : '';
  if (modelType && !['Model 19', 'Model 22'].includes(modelType)) {
    return res.status(400).json({ success: false, message: 'Choose a valid inventory transaction model.' });
  }
  try {
    const filter = modelType ? { modelType } : {};
    const transactions = await DispensaryInventoryTransaction.find(filter)
      .sort({ transactionDate: -1 })
      .limit(200)
      .lean();
    return res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    console.error('Failed to load dispensary inventory transactions:', error);
    return res.status(500).json({ success: false, message: 'Unable to load dispensary inventory transactions.' });
  }
};
