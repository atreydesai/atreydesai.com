import { servicePlan, type ServiceOrder, type ServiceReceipt, type ServiceState } from "./orders-service.ts";

type ContractKind = "serve" | "quality" | "fast" | "fruit" | "bun" | "request";

interface ShiftContract {
  id: ContractKind;
  icon: string;
  text: string;
  target: number;
  reward: number;
  qualifies: (receipt: ServiceReceipt, order?: ServiceOrder) => boolean;
}

export type ShiftContractProgress = Pick<ShiftContract, "id" | "icon" | "text" | "target" | "reward"> & {
  count: number;
  complete: boolean;
};

const hasFruit = (order: ServiceOrder) => order.recipe.mixins.length > 0;
const hasBun = (order: ServiceOrder) => order.recipe.bun;

export function shiftContracts(state: ServiceState): ShiftContractProgress[] {
  const { day, expert, orders, receipts } = state;
  const plan = state.orderPlan ?? servicePlan(orders);
  if (!plan.orders) return [];

  const served = day === 1 ? 1 : Math.min(plan.orders, expert ? 3 : 2);
  const qualityGrade = day === 1 ? 75 : expert ? 94 : 88;
  const qualityTarget = Math.min(plan.orders, day === 1 ? 1 : expert ? 3 : 2);
  const waitGrade = expert ? 95 : 90;
  const fastTarget = Math.min(plan.orders, expert ? 3 : 2);

  const first: ShiftContract = {
    id: "serve", icon: "serve", text: `Serve ${served} ${served === 1 ? "order" : "orders"}`,
    target: served, reward: day === 1 ? 100 : expert ? 210 : 150, qualifies: () => true,
  };
  const quality: ShiftContract = {
    id: "quality", icon: "quality", text: `Serve ${qualityTarget} at ${qualityGrade}% quality or higher`,
    target: qualityTarget, reward: day === 1 ? 150 : expert ? 420 : 300,
    qualifies: (receipt) => receipt.quality >= qualityGrade,
  };
  const fast: ShiftContract = {
    id: "fast", icon: "rush", text: `Serve ${fastTarget} at ${waitGrade}% wait and 70% quality or higher`,
    target: fastTarget, reward: expert ? 420 : 300,
    qualifies: (receipt) => receipt.quality >= 70 && receipt.grades.wait >= waitGrade,
  };

  const specialists: ShiftContract[] = [];
  const fruitTarget = Math.min(plan.fruit, expert ? 3 : 2);
  if (fruitTarget) {
    const grade = expert ? 90 : 80;
    specialists.push({
      id: "fruit", icon: "strawberry",
      text: `Match ${fruitTarget} fruit ${fruitTarget === 1 ? "recipe" : "recipes"} at ${grade}% quality or higher`,
      target: fruitTarget, reward: (expert ? 220 : 175) + fruitTarget * 75,
      qualifies: (receipt, order) => Boolean(order && hasFruit(order)) && receipt.grades.build === 100 &&
        receipt.quality >= grade,
    });
  }

  const bunTarget = Math.min(plan.buns, expert ? 3 : 2);
  if (bunTarget) {
    const grade = expert ? 94 : 86;
    specialists.push({
      id: "bun", icon: "bun", text: `Match ${bunTarget} bun ${bunTarget === 1 ? "order" : "orders"} at ${grade}% finish or higher`,
      target: bunTarget, reward: (expert ? 220 : 175) + bunTarget * 75,
      qualifies: (receipt, order) => Boolean(order && hasBun(order)) && receipt.grades.build === 100 &&
        receipt.grades.finish >= grade,
    });
  }

  if (plan.special) {
    specialists.push({
      id: "request", icon: "special", text: "Earn a regular’s special request bonus",
      target: 1, reward: expert ? 450 : 350, qualifies: (receipt) => (receipt.specialBonus ?? 0) > 0,
    });
  }

  const secondary = [...specialists, fast, quality];
  const contracts = day === 1 ? [first, quality] : [day % 2 ? first : quality, secondary[(day - 2) % secondary.length]];
  if (contracts[0].id === contracts[1].id) contracts[1] = fast;

  const orderById = new Map(orders.map((order) => [order.id, order]));
  return contracts.map(({ qualifies, ...contract }) => {
    const count = Math.min(contract.target, receipts.filter((receipt) => qualifies(receipt, orderById.get(receipt.orderId))).length);
    return { ...contract, count, complete: count >= contract.target };
  });
}

export function shiftContractReward(state: ServiceState): number {
  return shiftContracts(state).reduce((total, contract) => total + (contract.complete ? contract.reward : 0), 0);
}
