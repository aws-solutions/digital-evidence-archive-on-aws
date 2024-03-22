import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { FormFieldModal } from '../../../src/components/common-components/FormFieldModal';
import { commonLabels } from '../../../src/common/labels';

const validProps = {
  modalTestId: '',
  inputTestId: '',
  cancelButtonTestId: 'cancelbutton',
  primaryButtonTestId: '',
  isOpen: true,
  title: '',
  inputHeader: '',
  inputDetails: '',
  inputField: '',
  setInputField: jest.fn(),
  confirmAction: jest.fn(),
  confirmButtonText: '',
  cancelAction: jest.fn(),
  cancelButtonText: commonLabels.cancelButton,
};

describe('formfield modal', () => {
  it('shows cancel button prop text', async () => {
    const page = render(<FormFieldModal {...validProps} />);
    const button = page.getByTestId(validProps.cancelButtonTestId);
    expect(button).toHaveTextContent(validProps.cancelButtonText);
  });
});
