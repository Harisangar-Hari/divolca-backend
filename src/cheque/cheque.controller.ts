import { Controller, Param, Post } from '@nestjs/common';
import { ChequeService } from './cheque.service';


@Controller('cheques')
export class ChequeController {


    constructor(
        private chequeService: ChequeService
    ) { }



    @Post('process')
    async processCheques() {

        return this.chequeService.processDueCheques();

    }

    @Post(':id/clear')
    async clearCheque(
        @Param('id') id: string
    ) {

        return this.chequeService.clearCheque(id);

    }


}