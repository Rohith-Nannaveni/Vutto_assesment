// Central place for auction state rules. Used by services and serializers only.
export const STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
});

export const OPEN_STATUSES = [STATUS.SCHEDULED, STATUS.ACTIVE];

// Valid transitions. "ended" and "cancelled" are terminal.
export const TRANSITIONS = {
  [STATUS.SCHEDULED]: [STATUS.ACTIVE, STATUS.CANCELLED, STATUS.ENDED],
  [STATUS.ACTIVE]: [STATUS.ENDED, STATUS.CANCELLED],
  [STATUS.ENDED]: [],
  [STATUS.CANCELLED]: [],
};

export const canTransition = (from, to) => TRANSITIONS[from]?.includes(to) ?? false;

// currentBid equals startingPrice until the first bid arrives; bidCount disambiguates.
// The first bid may equal the starting price; later bids must beat the current bid by minIncrement.
export const minimumNextBid = (a) => (a.bidCount === 0 ? a.startingPrice : a.currentBid + a.minIncrement);

// Fields an admin may change depending on the lifecycle state. Bid history and winners are never editable.
export const EDITABLE_FIELDS = {
  [STATUS.SCHEDULED]: [
    'title', 'brand', 'model', 'year', 'mileageKm', 'engineCc', 'condition', 'description',
    'location', 'images', 'startingPrice', 'minIncrement', 'startTime', 'endTime',
  ],
  // Once live, only descriptive content may change; price, increment and timing are locked.
  [STATUS.ACTIVE]: ['description', 'location', 'images'],
  [STATUS.ENDED]: [],
  [STATUS.CANCELLED]: [],
};
