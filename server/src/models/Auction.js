import mongoose from 'mongoose';
import { STATUS } from '../utils/auctionRules.js';

const { Schema } = mongoose;

const auctionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    brand: { type: String, required: true, trim: true, maxlength: 40 },
    model: { type: String, required: true, trim: true, maxlength: 60 },
    year: { type: Number, required: true, min: 1950 },
    mileageKm: { type: Number, required: true, min: 0 },
    engineCc: { type: Number, required: true, min: 1 },
    condition: { type: String, enum: ['excellent', 'good', 'fair', 'needs-work'], required: true },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    location: { type: String, required: true, trim: true, maxlength: 80 },
    images: { type: [String], validate: (v) => v.length >= 1 && v.length <= 8 },

    startingPrice: { type: Number, required: true, min: 1 },
    minIncrement: { type: Number, required: true, min: 1 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: Object.values(STATUS), default: STATUS.SCHEDULED, required: true },

    // Bidding state. Mutated ONLY through bidService's conditional update.
    // currentBid starts equal to startingPrice (so price sorting/filtering is a plain field);
    // bidCount === 0 means "no bids yet". bidCount doubles as the optimistic-concurrency version.
    currentBid: { type: Number, required: true, min: 0 },
    bidCount: { type: Number, default: 0, min: 0 },
    highestBidder: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // Written once at finalization, derived from persisted bids.
    winner: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    finalPrice: { type: Number, default: null },
    finalizedAt: { type: Date, default: null },

    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancelReason: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true },
);

auctionSchema.index({ status: 1, endTime: 1 });
auctionSchema.index({ status: 1, startTime: 1 });
auctionSchema.index({ createdAt: -1 });
auctionSchema.index({ brand: 1 });
auctionSchema.index({ seller: 1, createdAt: -1 });

export const Auction = mongoose.model('Auction', auctionSchema);
