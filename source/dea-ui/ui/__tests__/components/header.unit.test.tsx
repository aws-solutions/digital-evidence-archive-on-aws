import { fireEvent, render, screen } from "@testing-library/react";
import Header from "../../src/components/Header"

describe('header', () => {
    it('renders top navigation with sign out', async () => {
        render(<Header/>);
        const nav = screen.getByTestId('header-top-navigation');

        expect(nav).toBeTruthy();

        //click the user button to reveal the signout button
        const userBtn = await screen.findByRole('button');
        expect(userBtn).toBeTruthy();
        fireEvent.click(userBtn);

        const signOutBtn = await screen.findByText('Sign out');
        expect(signOutBtn).toBeTruthy();
        fireEvent.click(signOutBtn);
    });
});