import mongoose from 'mongoose';

const { Schema } = mongoose;

// Append-only record of accepted bids. Rejected bids are never stored here.
const bidSchema = new Schema(
  {
    auction: { type: Schema.Types.ObjectId, ref: 'Auction', required: true },
    bidder: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    // 1-based position in the auction's bid sequence (= auction.bidCount after acceptance).
    sequence: { type: Number, required: true, min: 1 },
    source: { type: String, enum: ['rest', 'socket', 'seed'], default: 'rest' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Safety net: two accepted bids can never claim the same position in one auction.
bidSchema.index({ auction: 1, sequence: 1 }, { unique: true });
bidSchema.index({ auction: 1, createdAt: -1 });
bidSchema.index({ bidder: 1, createdAt: -1 });

export const Bid = mongoose.model('Bid', bidSchema);
