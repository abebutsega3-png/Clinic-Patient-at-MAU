import express from 'express';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementOptions,
  listAnnouncements,
  updateAnnouncement,
  updateAnnouncementReadStatus,
} from '../controller/staffAnnouncementController.js';
import verifyUser from '../middleware/authmiddleware.js';

const router = express.Router();

router.use(verifyUser, (req, res, next) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({ success: false, message: 'Change your temporary password before continuing.' });
  }
  return next();
});

router.get('/options', getAnnouncementOptions);
router.get('/', listAnnouncements);
router.post('/', createAnnouncement);
router.patch('/:id', updateAnnouncement);
router.delete('/:id', deleteAnnouncement);
router.patch('/:id/read-status', updateAnnouncementReadStatus);

export default router;
