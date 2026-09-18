import { Controller, Get, Param } from '@nestjs/common';
import { CustomerLedgerService } from './customer-ledger.service';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('customer-ledger')
export class CustomerLedgerController {
    constructor(private service: CustomerLedgerService) { }

    @Get(':customerId')
    @Permissions('canViewCustomers')
    async getLedger(@Param('customerId') customerId: string) {
        return this.service.getLedger(customerId);
    }
}