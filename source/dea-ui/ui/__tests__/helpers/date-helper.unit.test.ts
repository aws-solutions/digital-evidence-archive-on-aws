import * as datehelper from '../../src/helpers/dateHelper';

const date1 = new Date('05 October 2011 14:48 UTC');

describe('date helper', () => {
  it('is not iso string', async () => {
    expect(datehelper.formatDate(undefined, 'en-us')).toEqual('-');
    expect(datehelper.formatDate(undefined)).toEqual('-');
    expect(datehelper.formatDateTime(undefined, 'en-us')).toEqual('-');
    expect(datehelper.formatDateTime(undefined)).toEqual('-');
  });
});
