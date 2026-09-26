// Abstract base for everyone who signs in. Each subclass is one role: it names
// its role string in `static role`, and the subclass chain is the role
// hierarchy - a CommunityVolunteer is a Citizen, so anything that admits a
// Citizen admits a CommunityVolunteer (see AuthMiddleware.requireRole).
//
// Only `name` is stored on the User document today; phone and nic are part of
// the design but not persisted yet, so they are undefined for a Person built
// from the database.
export class Person {
  // The role string this class stands for; set by every concrete subclass.
  static role = undefined;

  // Whether public registration may create this role. Inherited, so a subclass
  // of a self-registrable role is self-registrable unless it says otherwise.
  static selfRegistrable = false;

  #name;
  #phone;
  #nic;

  constructor({ name, phone, nic } = {}) {
    if (new.target === Person) {
      throw new Error('Person is abstract - construct one of its role subclasses instead');
    }
    this.#name = name;
    this.#phone = phone;
    this.#nic = nic;
  }

  get role() {
    return this.constructor.role;
  }

  get name() {
    return this.#name;
  }

  get phone() {
    return this.#phone;
  }

  get nic() {
    return this.#nic;
  }
}
