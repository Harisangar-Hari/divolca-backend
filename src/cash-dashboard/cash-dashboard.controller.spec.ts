import { Test, TestingModule } from '@nestjs/testing';
import { CashDashboardController } from './cash-dashboard.controller';

describe('CashDashboardController', () => {
  let controller: CashDashboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashDashboardController],
    }).compile();

    controller = module.get<CashDashboardController>(CashDashboardController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
