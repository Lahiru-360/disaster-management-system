import { District } from './District.js';
import { TargetArea } from './TargetArea.js';

// A river basin, which spans one or more districts - the reason District no
// longer carries a riverBasin string: a single name can't express a basin
// that crosses district borders.
export class RiverBasin extends TargetArea {
  #districts;

  constructor({ districts = [], ...area } = {}) {
    super(area);
    if (districts.length === 0) {
      throw new Error(`RiverBasin "${area.name}" must span at least one district`);
    }
    if (!districts.every((district) => district instanceof District)) {
      throw new Error(`RiverBasin "${area.name}" can only span District objects`);
    }
    this.#districts = [...districts];
  }

  /** The districts this basin spans, as a copy. */
  get districts() {
    return [...this.#districts];
  }

  /**
   * True when the citizen's home district is one the basin spans.
   * @param {{ homeDistrict?: District|string|object }} citizen
   * @returns {boolean}
   */
  contains(citizen) {
    return this.#districts.some((district) => district.contains(citizen));
  }
}
