const Request = require('../models/RequestsAndProcurement');

// Get requests for Card Room
exports.getCardRoomRequests = async (req, res) => {
  try {
    const requests = await Request.find({ department: 'Card Room' }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new request (Purchase or Leave)
exports.createRequest = async (req, res) => {
  try {
    const newRequest = new Request(req.body);
    await newRequest.save();
    res.status(201).json(newRequest);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};