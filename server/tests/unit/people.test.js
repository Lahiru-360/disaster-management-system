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
    expect(new Citizen({ homeDistrict: 'Colombo' }).homeDistrict).toBe('Colombo');
  });

  it('DMS-105: builds every role with no details at all', () => {
    expect(new Citizen().homeDistrict).toBeUndefined();
    expect(new DistrictOfficer().district).toBeUndefined();
    expect(new DutyOfficer().shiftDistrict).toBeUndefined();
    expect(new RescueTeamLead().name).toBeUndefined();
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

  it('DMS-105: maps phone and homeDistrict onto a Citizen', () => {
    const person = PersonFactory.fromUser({
      name: 'Nimal Perera',
      role: Role.CITIZEN,
      phone: '0771234567',
      homeDistrict: 'colombo-id',
    });

    expect(person).toBeInstanceOf(Citizen);
    expect(person.phone).toBe('0771234567');
    expect(person.homeDistrict).toBe('colombo-id');
  });

  it('DMS-105: gives a CommunityVolunteer the homeDistrict it inherits from Citizen', () => {
    const person = PersonFactory.fromUser({
      name: 'Kamala Fernando',
      role: Role.COMMUNITY_VOLUNTEER,
      homeDistrict: 'colombo-id',
    });

    expect(person.homeDistrict).toBe('colombo-id');
  });

  it('DMS-105: maps district onto a DistrictOfficer', () => {
    const person = PersonFactory.fromUser({
      name: 'Dilani Wickramasinghe',
      role: Role.DISTRICT_OFFICER,
      district: 'gampaha-id',
    });

    expect(person).toBeInstanceOf(DistrictOfficer);
    expect(person.district).toBe('gampaha-id');
  });

  it('DMS-105: maps shiftDistrict onto a DutyOfficer', () => {
    const person = PersonFactory.fromUser({
      name: 'Kasun Silva',
      role: Role.DUTY_OFFICER,
      shiftDistrict: 'colombo-id',
    });

    expect(person).toBeInstanceOf(DutyOfficer);
    expect(person.shiftDistrict).toBe('colombo-id');
  });

  it('DMS-105: passes a populated District document through unchanged', () => {
    const colombo = { id: 'colombo-id', name: 'Colombo' };
    const person = PersonFactory.fromUser({
      name: 'Kasun Silva',
      role: Role.DUTY_OFFICER,
      shiftDistrict: colombo,
    });

    expect(person.shiftDistrict).toBe(colombo);
  });

  it("DMS-105: ignores a district field that is not the class's own", () => {
    const person = PersonFactory.fromUser({
      name: 'Nimal Perera',
      role: Role.CITIZEN,
      homeDistrict: 'colombo-id',
      shiftDistrict: 'gampaha-id',
    });

    expect(person).not.toHaveProperty('shiftDistrict');
  });

  it('DMS-105: leaves the profile fields undefined for a User without them', () => {
    const person = PersonFactory.fromUser({ name: 'Nimal Perera', role: Role.CITIZEN });

    expect(person.phone).toBeUndefined();
    expect(person.homeDistrict).toBeUndefined();
  });

  it('returns null for a User whose role no class stands for', () => {
    expect(PersonFactory.fromUser({ name: 'Former Role', role: 'former_role' })).toBeNull();
  });

  it('lists citizen and community volunteer as the self-registrable roles', () => {
    expect(PersonFactory.selfRegistrableRoles()).toEqual([Role.CITIZEN, Role.COMMUNITY_VOLUNTEER]);
  });
});
