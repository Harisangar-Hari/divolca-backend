import { Test, TestingModule } from '@nestjs/testing';
import { ChequeService } from './cheque.service';

describe('ChequeService', () => {
  let service: ChequeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChequeService],
    }).compile();

    service = module.get<ChequeService>(ChequeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
