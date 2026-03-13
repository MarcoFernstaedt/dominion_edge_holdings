import { render, screen, fireEvent } from '@testing-library/react';
import DSCRCalculator from '../modules/DSCRCalculator';

describe('DSCRCalculator', () => {
  it('renders the page heading', () => {
    render(<DSCRCalculator />);
    expect(screen.getByRole('heading', { name: /DSCR Calculator/i })).toBeInTheDocument();
  });

  it('shows a PASS or FAIL status on load', () => {
    render(<DSCRCalculator />);
    const passEl = screen.queryByText(/PASS/);
    const failEl = screen.queryByText(/FAIL/);
    expect(passEl || failEl).toBeTruthy();
  });

  it('SBA loan % slider updates its displayed value', () => {
    render(<DSCRCalculator />);
    // The SBA Loan % slider is the first range input
    const sliders = document.querySelectorAll('input[type="range"]');
    const sbaSlider = sliders[0];
    fireEvent.change(sbaSlider, { target: { value: '70' } });
    // The slider value label should now show 70%
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('purchase price number input updates the formatted display', () => {
    render(<DSCRCalculator />);
    const numberInputs = document.querySelectorAll('input[type="number"]');
    const priceInput = numberInputs[0]; // Purchase Price is first number input
    fireEvent.change(priceInput, { target: { value: '2000000' } });
    expect(screen.getByText('$2,000,000')).toBeInTheDocument();
  });
});
