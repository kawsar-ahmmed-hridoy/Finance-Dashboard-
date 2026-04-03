export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
}

export enum TransactionCategory {
  // Income
  SALARY = 'salary',
  FREELANCE = 'freelance',
  INVESTMENT = 'investment',
  RENTAL = 'rental',
  DIVIDEND = 'dividend',
  OTHER_INCOME = 'other_income',

  // Expense
  HOUSING = 'housing',
  FOOD = 'food',
  TRANSPORT = 'transport',
  UTILITIES = 'utilities',
  HEALTHCARE = 'healthcare',
  ENTERTAINMENT = 'entertainment',
  EDUCATION = 'education',
  SHOPPING = 'shopping',
  INSURANCE = 'insurance',
  TAXES = 'taxes',
  OTHER_EXPENSE = 'other_expense',

  // Transfer
  TRANSFER = 'transfer',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}
