type AgentMarkProps = {
  className?: string;
};

export function AgentMark({ className = "" }: AgentMarkProps) {
  return <img alt="" aria-hidden="true" className={className} src="/agent.svg" />;
}
