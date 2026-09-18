import { Controller, Param, Post } from '@nestjs/common';
import { ChequeService } from './cheque.service';
import { Permissions } from '../auth/decorators/permissions.decorator';

@Controller('cheques')
export class ChequeController {
    constructor(private chequeService: ChequeService) { }

    @Post('process')
    @Permissions('canManageSupplierCheques')
    async processCheques() {
        return this.chequeService.processDueCheques();
    }

    @Post(':id/clear')
    @Permissions('canManageSupplierCheques')
    async clearCheque(@Param('id') id: string) {
        return this.chequeService.clearCheque(id);
    }
}