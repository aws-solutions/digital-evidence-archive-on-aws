import { render } from "@testing-library/react";
import { SettingsProvider } from "../../src/context/SettingsContext";

describe('settings provider', () => {
    it('should render the settings provider', () => {
        render(<SettingsProvider children={false}/>);
    });
});
