import ClinicNotification from '../module/ClinicNotification.js';
import User from '../module/User.js';

export const notifyClinicHeads = async ({
  batchId,
  title,
  message,
  targetPath = '',
  priority = 'high',
  notificationType = 'system_announcement',
  request = null
}) => {
  const clinicHeadRole = /^clinic head$/i;
  const clinicHeads = await User.find({
    status: { $ne: 'Inactive' },
    $or: [
      { role: clinicHeadRole },
      { activeRole: clinicHeadRole },
      { roles: clinicHeadRole }
    ],
    'notificationPreferences.systemNotification': { $ne: false }
  }).select('_id').lean();

  if (!clinicHeads.length) return 0;

  let result;
  try {
    result = await ClinicNotification.bulkWrite(clinicHeads.map(({ _id }) => ({
      updateOne: {
        filter: { batchId, recipient: _id },
        update: {
          $setOnInsert: {
            recipient: _id,
            request,
            title,
            message,
            notificationType,
            channel: 'in_app',
            priority,
            recipientRole: 'Clinic Head',
            targetPath,
            deliveryStatus: 'created',
            batchId
          }
        },
        upsert: true
      }
    })), { ordered: false });
  } catch (error) {
    const duplicateOnly = error.code === 11000
      || (error.writeErrors?.length && error.writeErrors.every(({ code }) => code === 11000));
    if (!duplicateOnly) throw error;
    return 0;
  }

  return result.upsertedCount || 0;
};
