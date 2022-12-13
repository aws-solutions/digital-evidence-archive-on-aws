import { CaseAction } from "./case-action";

export interface CaseUser {
    readonly caseUlid: string,
    readonly userUlid: string,
    readonly actions: CaseAction[],
    readonly caseName: string,
    readonly userFirstName: string,
    readonly userLastName: string,
}