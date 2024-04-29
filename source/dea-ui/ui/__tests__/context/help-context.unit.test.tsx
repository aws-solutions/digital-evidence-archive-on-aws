import { renderHook, act, render } from '@testing-library/react';
import { HelpProvider, useHelp } from '../../src/context/HelpContext';

describe('help provider', () => {
  it('should render the help provider', () => {
    render(<HelpProvider children={false} />);
  });

  it('should initialize the default state', () => {
    const { result } = renderHook(() => useHelp(), {
      wrapper: HelpProvider,
    });

    expect(result.current.state).toEqual({
      toolsOpen: false,
      helpPanelTopic: 'default',
    });
  });

  it('should update the toolsOpen state', () => {
    const { result } = renderHook(() => useHelp(), {
      wrapper: HelpProvider,
    });

    act(() => {
      result.current.setToolsOpen(true);
    });

    expect(result.current.state.toolsOpen).toBe(true);
  });

  it('should update the helpPanelTopic state', () => {
    const { result } = renderHook(() => useHelp(), {
      wrapper: HelpProvider,
    });

    act(() => {
      result.current.setHelpPanelTopic('new-topic');
    });

    expect(result.current.state.helpPanelTopic).toBe('new-topic');
  });

  it('should create a makeHelpPanelHandler function', () => {
    const { result } = renderHook(() => useHelp(), {
      wrapper: HelpProvider,
    });

    const handler = result.current.makeHelpPanelHandler('some-topic');
    expect(typeof handler).toBe('function');

    act(() => {
      handler();
    });

    expect(result.current.state.toolsOpen).toBe(true);
    expect(result.current.state.helpPanelTopic).toBe('some-topic');
  });
});
