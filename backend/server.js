const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB connected'))
.catch(err => console.log(err));

const gameRoutes = require('./routes/games');
const transactionRoutes = require('./routes/transactions');
const smileOneRoutes = require('./routes/smileone');
const { router: moogoldRoutes } = require('./routes/moogold');
const bakongRoutes = require('./routes/bakong');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const sliderRoutes = require('./routes/sliders');
const userRoutes = require('./routes/users');
const pageRoutes = require('./routes/pages');
const updatesRouter = express.Router();
const { addClient } = require('./sse');

updatesRouter.get('/stream', (req, res) => {
    addClient(req, res);
});

// Use Routes
app.use('/api/games', gameRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/smileone', smileOneRoutes);
app.use('/api/moogold', moogoldRoutes);
app.use('/api/bakong', bakongRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/sliders', sliderRoutes);
app.use('/api/updates', updatesRouter);
app.use('/api/users', userRoutes);
app.use('/api/pages', pageRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
