import { Contract, Event } from "@ethersproject/contracts";

export const getEvents = async (
  contract: Contract,
  eventName: string,
  topicFilters: any[] = []
): Promise<Event[]> => {
  const filterFn = contract.filters[eventName];

  if (!filterFn) {
    throw new Error(`Event ${eventName} not found in contract`);
  }

  const filter = filterFn(...topicFilters);
  const events = await contract.queryFilter(filter);

  return events;
};

export const getEvent = async (
  contract: Contract,
  txHash: string,
  eventName: string,
  topicFilters?: any[],
  eventArg?: string
): Promise<any> => {
  const events = await getEvents(contract, eventName, topicFilters);

  // Filter both by tx hash and event signature hash
  const [event] = events.filter(
    (event) =>
      event.transactionHash === txHash && event.topics[0] === event.topics[0]
  );

  if (eventArg) {
    const argValue = event.args[eventArg];

    if (!argValue) {
      throw new Error(`Argument ${eventArg} not found in event ${eventName}`);
    }

    return argValue;
  } else {
    return event.args;
  }
};
