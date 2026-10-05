// A random UUID v4, for a hazard report's clientReportId (contract §9.2): the
// app makes one per report so a resend after a dropped connection isn't
// stored twice. Math.random is enough here - it only has to be unique per
// device, not unguessable - and needs no native module.
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random % 4) + 8;
    return value.toString(16);
  });
}
