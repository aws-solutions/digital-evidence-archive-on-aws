import { render, screen } from "@testing-library/react";
import { TableHeader } from "../../../src/components/common-components/TableHeader";

describe('talbe header', () => {
    it('should render with a counter', async () => {
        render(<TableHeader counter='counter text'/>);
        const counter = await screen.findAllByText('counter text');
        expect(counter).toBeTruthy();
    });

    it('should render with no counter', () => {
        render(<TableHeader/>);
    });

    it('should render with items length', async () => {
        render(<TableHeader totalItems={[1,2,3]}/>);
        const counter = await screen.findAllByText('(3)');
        expect(counter).toBeTruthy();
    });

    it('should render with selected count', async () => {
        render(<TableHeader totalItems={[1,2,3]} selectedItems={[1,3]}/>);
        const counter = await screen.findAllByText('(2/3)');
        expect(counter).toBeTruthy();
    });
});
