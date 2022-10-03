import { getConstants } from './constants';

describe('constants', () => {
  it('should give us constant values', () => {
    const theConstants = getConstants();

    expect(theConstants).toBeTruthy();

    //spot check
    expect(theConstants.CLIENT_SECRET).toEqual('shh');
    expect(theConstants.AWS_REGION_SHORT_NAME).toEqual('Testville');
    expect(theConstants.ALLOWED_ORIGINS).toEqual(JSON.stringify(['test', 'https://bogus.bogus']));
  });
});
