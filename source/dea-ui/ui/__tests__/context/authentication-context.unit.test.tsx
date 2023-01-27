import { render } from "@testing-library/react";
import { AuthenticationProvider } from "../../src/context/AuthenticationContext";

describe('AuthenticationProvider', () => {
    it('renders an auth provider', () => {
        render(<AuthenticationProvider children={false}/>);
    });
});
