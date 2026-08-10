// Bounding box covering the wider Caribbean region: Cuba/Bahamas in the
// north, the Lesser Antilles arc in the east, Trinidad & the Venezuelan
// coast in the south, and Central America plus Colombia/Ecuador's Pacific
// and Caribbean coasts in the west/south.
//
// minLatitude was originally 7, which excluded the seismically active
// Colombia-Ecuador subduction zone (e.g. the M7.4 quake near San José del
// Palmar, Chocó on 2026-08-10 at ~4.9N was cut off by that line). Lowered
// to -2 to include all of mainland Colombia and coastal Ecuador, which
// are directly relevant to the region even though the epicenters
// themselves are Pacific-side rather than in the Caribbean Sea.
export const CARIBBEAN_BBOX = {
  minLatitude: -2,
  maxLatitude: 24,
  minLongitude: -90,
  maxLongitude: -58,
};
