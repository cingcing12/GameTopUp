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
const moogoldRoutes = require('./routes/moogold').router;
const bakongRoutes = require('./routes/bakong').router || require('./routes/bakong');
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
app.use('/api/moogold', moogoldRoutes);
app.use('/api/bakong', bakongRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/sliders', sliderRoutes);
app.use('/api/updates', updatesRouter);
app.use('/api/users', userRoutes);
app.use('/api/pages', pageRoutes);

app.get('/', (req, res) => {
    res.status(200).send("Server is running...");
});

// Background Auto-Sync Worker: Polls MooGold for orders in 'processing' status every 30 seconds
const Transaction = require('./models/Transaction');
const { checkMoogoldOrderStatus } = require('./routes/moogold');
const { sendEvent } = require('./sse');

const syncProcessingOrders = async () => {
    try {
        const activeTxs = await Transaction.find({ 
            status: 'processing', 
            providerReference: { $exists: true, $ne: null } 
        }).limit(10);

        for (const tx of activeTxs) {
            try {
                const info = await checkMoogoldOrderStatus(tx.providerReference);
                if (info && info.status) {
                    let changed = false;
                    if (info.status !== tx.status) {
                        tx.status = info.status;
                        changed = true;
                    }
                    if (info.status === 'completed' && tx.deliveryStatus !== 'delivered') {
                        tx.deliveryStatus = 'delivered';
                        changed = true;
                    } else if (info.status === 'failed' && tx.deliveryStatus !== 'failed') {
                        tx.deliveryStatus = 'failed';
                        tx.errorDetails = `MooGold: ${info.order_status || 'delivery failed'}`;
                        changed = true;
                    } else if (info.status === 'processing' && tx.deliveryStatus !== 'sending') {
                        tx.deliveryStatus = 'sending';
                        changed = true;
                    }
                    if (changed) {
                        await tx.save();
                        console.log(`[Auto-Sync] Order #${tx.providerReference} updated: status=${tx.status}, delivery=${tx.deliveryStatus}`);
                        sendEvent('transaction_updated', tx);
                    }
                }
            } catch (err) {
                // Ignore temporary polling network errors
            }
        }
    } catch (e) {
        // Ignore DB hiccups
    }
};

setInterval(syncProcessingOrders, 30000);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
