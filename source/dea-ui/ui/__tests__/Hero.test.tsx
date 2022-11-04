import { render } from '@testing-library/react';
import Hero from '@/components/Hero';

describe('Jest Snapshot testing suite', () => {
  it('Matches DOM Snapshot', () => {
    const { asFragment } = render(<Hero />);
    expect(asFragment()).toMatchSnapshot();
  });
});
