export const makeAuction = (over = {}) => ({
  id: 'a1', title: '2018 KTM Duke 390', brand: 'KTM', model: 'Duke 390', year: 2018, mileageKm: 22000, engineCc: 373,
  condition: 'good', description: 'Well maintained Duke 390 with fresh brake pads and chain set.', location: 'Bengaluru',
  images: ['/images/bikes/ktm-duke-390-1.svg'], startingPrice: 135000, minIncrement: 2000,
  startTime: new Date(Date.now() - 86400e3).toISOString(), endTime: new Date(Date.now() + 5 * 3600e3).toISOString(),
  status: 'active', currentBid: 141000, bidCount: 3, minimumNextBid: 143000, leadingBidder: 'R••• S.', finalPrice: null,
  hasWinner: false, isLeading: false, isWinner: false, isOwnListing: false, serverTime: new Date().toISOString(), ...over,
});
