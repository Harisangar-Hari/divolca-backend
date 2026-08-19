import { Test, TestingModule } from '@nestjs/testing';
import { ChequeController } from './cheque.controller';

describe('ChequeController', () => {
  let controller: ChequeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChequeController],
    }).compile();

    controller = module.get<ChequeController>(ChequeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
