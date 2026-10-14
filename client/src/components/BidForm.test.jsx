import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BidForm from './BidForm.jsx';

const setup = (onSubmit = vi.fn().mockResolvedValue({ ok: true })) => {
  render(<BidForm minimumNextBid={143000} onSubmit={onSubmit} />);
  return { onSubmit, input: screen.getByLabelText(/your bid/i), button: screen.getByRole('button', { name: /place bid/i }) };
};

describe('BidForm', () => {
  it('rejects non-numeric input without calling the API', async () => {
    const { onSubmit, input, button } = setup();
    await userEvent.type(input, 'abc');
    await userEvent.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent(/whole-number/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects amounts below the minimum', async () => {
    const { onSubmit, input, button } = setup();
    await userEvent.type(input, '142999');
    await userEvent.click(button);
    expect(screen.getByRole('alert')).toHaveTextContent('at least ₹1,43,000');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid amount as a number (commas allowed) and clears the field', async () => {
    const { onSubmit, input, button } = setup();
    await userEvent.type(input, '1,45,000');
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith(145000);
    expect(input).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the server rejection message and keeps the typed amount', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, message: 'Your bid must be at least 150000.' });
    const { input, button } = setup(onSubmit);
    await userEvent.type(input, '143000');
    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Your bid must be at least 150000.');
    expect(input).toHaveValue('143000');
  });

  it('fills in the minimum bid on request', async () => {
    const { input } = setup();
    await userEvent.click(screen.getByRole('button', { name: /use minimum/i }));
    expect(input).toHaveValue('143000');
  });
});
