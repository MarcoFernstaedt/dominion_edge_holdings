import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import Checklist from '../modules/Checklist';
import { PHASES } from '../data/checklistData';

function buildInitialState(done = false) {
  return PHASES.reduce((acc, phase) => {
    phase.items.forEach(item => { acc[item.id] = done; });
    return acc;
  }, {});
}

describe('Checklist', () => {
  it('renders the QLA Checklist heading', () => {
    const state = buildInitialState();
    render(<Checklist checklistState={state} setChecklistState={() => {}} />);
    expect(screen.getByText('QLA Checklist')).toBeInTheDocument();
  });

  it('shows 0 of N steps done when nothing is checked', () => {
    const state = buildInitialState();
    const total = Object.keys(state).length;
    render(<Checklist checklistState={state} setChecklistState={() => {}} />);
    expect(screen.getByText(`Complete start-to-exit roadmap — 0 of ${total} steps done`)).toBeInTheDocument();
  });

  it('renders all phase names', () => {
    const state = buildInitialState();
    render(<Checklist checklistState={state} setChecklistState={() => {}} />);
    PHASES.forEach(phase => {
      expect(screen.getByText(phase.name)).toBeInTheDocument();
    });
  });

  it('calls setChecklistState when a checklist item is clicked', () => {
    const state = buildInitialState();
    const setChecklistState = vi.fn();
    render(<Checklist checklistState={state} setChecklistState={setChecklistState} />);

    // First phase is open by default — click the first visible item text
    const firstItem = PHASES[0].items[0];
    const itemEl = screen.getByText(firstItem.text);
    fireEvent.click(itemEl);

    expect(setChecklistState).toHaveBeenCalledTimes(1);
  });
});
