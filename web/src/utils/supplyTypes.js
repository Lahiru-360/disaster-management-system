// How the console names each SupplyType (server/src/enums/SupplyType.js), as
// in the Log Relief Supply wireframe ("Drinking water").
export const SUPPLY_TYPE_LABELS = {
  FOOD: 'Food',
  WATER: 'Drinking water',
  MEDICINE: 'Medicine',
  BLANKETS: 'Blankets',
  HYGIENE_KITS: 'Hygiene kits',
};

/**
 * The label for a supply type, or the type itself when it isn't known.
 * @param {string} supplyType
 * @returns {string}
 */
export const supplyTypeLabel = (supplyType) => SUPPLY_TYPE_LABELS[supplyType] ?? supplyType;
