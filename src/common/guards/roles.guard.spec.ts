import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';

describe('RolesGuard', () => {
  const getRequest = jest.fn();

  const mockContext = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest }),
  } as unknown as ExecutionContext;

  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(reflector);
    jest.clearAllMocks();
  });

  it('allows access when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('throws when role is required but user is missing', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN]);
    getRequest.mockReturnValue({ user: null });

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('blocks viewer for analyst-only endpoints', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ANALYST]);
    getRequest.mockReturnValue({ user: { role: Role.VIEWER } });

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
  });

  it('allows admin for analyst-only endpoints through hierarchy', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ANALYST]);
    getRequest.mockReturnValue({ user: { role: Role.ADMIN } });

    expect(guard.canActivate(mockContext)).toBe(true);
  });
});
