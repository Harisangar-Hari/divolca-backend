import { Test, TestingModule } from '@nestjs/testing';
import { ChequeDashboardController } from './cheque-dashboard.controller';

describe('ChequeDashboardController', () => {
  let controller: ChequeDashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChequeDashboardController],
    }).compile();

    controller = module.get<ChequeDashboardController>(ChequeDashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
