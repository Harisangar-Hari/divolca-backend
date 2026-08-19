import { Controller, Get, Param } from '@nestjs/common';
import { CustomerLedgerService } from './customer-ledger.service';


@Controller('customer-ledger')
export class CustomerLedgerController {


    constructor(
        private service: CustomerLedgerService
    ) { }



    @Get(':customerId')
    async getLedger(
        @Param('customerId') customerId: string
    ) {

        return this.service.getLedger(customerId);

    }

}