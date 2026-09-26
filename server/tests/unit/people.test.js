import { Citizen } from '../../src/domain/people/Citizen.js';
import { CommunityVolunteer } from '../../src/domain/people/CommunityVolunteer.js';
import { DistrictOfficer } from '../../src/domain/people/DistrictOfficer.js';
import { DMCOfficer } from '../../src/domain/people/DMCOfficer.js';
import { DutyOfficer } from '../../src/domain/people/DutyOfficer.js';
import { Person } from '../../src/domain/people/Person.js';
import { PersonFactory } from '../../src/domain/people/PersonFactory.js';
import { RescueTeamLead } from '../../src/domain/people/RescueTeamLead.js';
import { Role } from '../../src/enums/Role.js';

describe('Person hierarchy', () => {
  it('cannot construct Person itself', () => {
    expect(() => new Person({ name: 'Nobody' })).toThrow('Person is abstract');
  });

  it('makes a CommunityVolunteer a Citizen and a Person', () => {
    const volunteer = new CommunityVolunteer({ name: 'Kamala Fernando' });

    expect(volunteer).toBeInstanceOf(CommunityVolunteer);
    expect(volunteer).toBeInstanceOf(Citizen);
    expect(volunteer).toBeInstanceOf(Person);
  });

  it('makes a DutyOfficer a DMCOfficer and a Person', () => {
    const dutyOfficer = new DutyOfficer({ name: 'Kasun Silva' });

    expect(dutyOfficer).toBeInstanceOf(DutyOfficer);
    expect(dutyOfficer).toBeInstanceOf(DMCOfficer);
    expect(dutyOfficer).toBeInstanceOf(Person);
  });

  it('does not make a parent an instance of its subclass', () => {
    expect(new Citizen({ name: 'Nimal Perera' })).not.toBeInstanceOf(CommunityVolunteer);
    expect(new DMCOfficer({ name: 'Ruwan Jayasinghe' })).not.toBeInstanceOf(DutyOfficer);
  });

  it('keeps separate branches separate', () => {
    expect(new DistrictOfficer({ name: 'Dilani Wickramasinghe' })).not.toBeInstanceOf(DMCOfficer);
    expect(new RescueTeamLead({ name: 'Suresh Bandara' })).not.toBeInstanceOf(Citizen);
    expect(new DutyOfficer({ name: 'Kasun Silva' })).not.toBeInstanceOf(Citizen);
  });

  it('gives every subclass the Person details', () => {
    const dutyOfficer = new DutyOfficer({
      name: 'Kasun Silva',
      phone: '0771234567',
      nic: '199012345678',
      shiftDistrict: 'Colombo',
    });

    expect(dutyOfficer.name).toBe('Kasun Silva');
    expect(dutyOfficer.phone).toBe('0771234567');
    expect(dutyOfficer.nic).toBe('199012345678');
    expect(dutyOfficer.shiftDistrict).toBe('Colombo');
  });

  it("keeps each subclass's own field", () => {
    expect(new CommunityVolunteer({ trainingLevel: 'First aid' }).trainingLevel).toBe('First aid');
    expect(new DistrictOfficer({ district: 'Gampaha' }).district).toBe('Gampaha');
  });

  it('takes its role from its class', () => {
    expect(new Citizen({}).role).toBe(Role.CITIZEN);
    expect(new CommunityVolunteer({}).role).toBe(Role.COMMUNITY_VOLUNTEER);
    expect(new DMCOfficer({}).role).toBe(Role.DMC_OFFICER);
    expect(new DutyOfficer({}).role).toBe(Role.DUTY_OFFICER);
    expect(new DistrictOfficer({}).role).toBe(Role.DISTRICT_OFFICER);
    expect(new RescueTeamLead({}).role).toBe(Role.RESCUE_TEAM_LEAD);
  });

  it('inherits self-registration from Citizen and nowhere else', () => {
    expect(Citizen.selfRegistrable).toBe(true);
    expect(CommunityVolunteer.selfRegistrable).toBe(true);
    expect(DMCOfficer.selfRegistrable).toBe(false);
    expect(DutyOfficer.selfRegistrable).toBe(false);
    expect(DistrictOfficer.selfRegistrable).toBe(false);
    expect(RescueTeamLead.selfRegistrable).toBe(false);
  });
});

describe('PersonFactory', () => {
  it('has exactly one class for every Role value', () => {
    const roles = PersonFactory.classes().map((PersonClass) => PersonClass.role);

    expect(new Set(roles).size).toBe(roles.length);
    expect([...roles].sort()).toEqual(Object.values(Role).sort());
  });

  it.each([
    [Role.CITIZEN, Citizen],
    [Role.COMMUNITY_VOLUNTEER, CommunityVolunteer],
    [Role.DMC_OFFICER, DMCOfficer],
    [Role.DUTY_OFFICER, DutyOfficer],
    [Role.DISTRICT_OFFICER, DistrictOfficer],
    [Role.RESCUE_TEAM_LEAD, RescueTeamLead],
  ])('resolves %s to its class', (role, PersonClass) => {
    expect(PersonFactory.classFor(role)).toBe(PersonClass);
  });

  it('throws for an unknown role', () => {
    expect(() => PersonFactory.classFor('typo')).toThrow('Unknown role "typo"');
  });

  it('builds the matching Person from a User document', () => {
    const person = PersonFactory.fromUser({ name: 'Kasun Silva', role: Role.DUTY_OFFICER });

    expect(person).toBeInstanceOf(DutyOfficer);
    expect(person.name).toBe('Kasun Silva');
  });

  it('returns null for a User whose role no class stands for', () => {
    expect(PersonFactory.fromUser({ name: 'Former Role', role: 'former_role' })).toBeNull();
  });

  it('lists citizen and community volunteer as the self-registrable roles', () => {
    expect(PersonFactory.selfRegistrableRoles()).toEqual([Role.CITIZEN, Role.COMMUNITY_VOLUNTEER]);
  });
});
