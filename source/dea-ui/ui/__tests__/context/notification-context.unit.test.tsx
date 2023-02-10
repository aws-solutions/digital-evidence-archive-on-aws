import { render } from "@testing-library/react";
import { useNotifications, NotificationsProvider } from "../../src/context/NotificationContext";

describe('NotificationContext', () => {
    it('renders notification context', () => {
        render(<NotificationsProvider children={false}/>);
    });
});
