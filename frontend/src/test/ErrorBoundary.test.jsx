import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';

function Bomb({ shouldThrow }) {
  if (shouldThrow) throw new Error('Test explosion');
  return <div>All good</div>;
}

// Wrapper lets us toggle shouldThrow from outside the ErrorBoundary
function ControlledBomb() {
  const [shouldThrow, setShouldThrow] = useState(true);
  return (
    <>
      <button onClick={() => setShouldThrow(false)}>Fix it</button>
      <ErrorBoundary>
        <Bomb shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </>
  );
}

describe('ErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => console.error.mockRestore());

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders the fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test explosion')).toBeInTheDocument();
  });

  it('resets and re-renders children after clicking Try Again (when error is resolved)', () => {
    render(<ControlledBomb />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    // Fix the underlying error first, then reset the boundary
    fireEvent.click(screen.getByText('Fix it'));
    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});
