import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Seat {
  number: string;
  status: "available" | "occupied" | "selected" | "free" | "reserved";
  occupantName?: string;
  floor: "superior" | "inferior";
}

interface BusSeatPickerProps {
  seats: Seat[];
  onSeatClick?: (seatNumber: string) => void;
  compact?: boolean; // para uso no modal de Nova Venda (menor)
  hideOccupantName?: boolean; // ocultar nome do passageiro (visão do cliente)
  allowReleaseOccupied?: boolean; // permite clicar em ocupadas (admin)
}

export const BusSeatPicker: React.FC<BusSeatPickerProps> = ({ seats, onSeatClick, compact = false, hideOccupantName = false, allowReleaseOccupied = false }) => {
  const getSeat = (num: string) => {
    const found = seats.find((s) => s.number === num);
    return found || { number: num, status: "available" as const, occupantName: undefined, floor: "superior" as const };
  };

  const btnSize = compact ? "w-7 h-7 text-[9px]" : "w-10 h-10 text-[11px]";
  const gap = compact ? "gap-y-1 gap-x-0.5" : "gap-y-2 gap-x-1";
  const padding = compact ? "p-2" : "p-4";
  const titleSize = compact ? "text-[10px]" : "text-sm";
  const archH = compact ? "h-8" : "h-10";

  const SeatBtn = ({ num }: { num: string }) => {
    const seat = getSeat(num);
    const isFree = seat.status === "available" || seat.status === "free";
    const isReserved = seat.status === "reserved" || seat.status === "occupied";
    const isSelected = seat.status === "selected";
    
    return (
      <TooltipProvider delayDuration={80}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onSeatClick?.(num)}
              className={`
                ${btnSize} rounded-lg font-bold border-2 shadow-sm flex items-center justify-center transition-all
                ${isReserved
                  ? "bg-red-500 border-red-700 text-white hover:bg-red-400 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                  : isSelected
                  ? "bg-orange-500 border-orange-700 text-white hover:bg-orange-400 hover:-translate-y-0.5 hover:shadow-md cursor-pointer ring-2 ring-orange-300"
                  : "bg-emerald-500 border-emerald-700 text-white hover:bg-emerald-400 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"}
              `}
            >
              {num}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-slate-900 border-slate-700 text-white text-xs font-medium z-50">
            {isReserved
              ? (!hideOccupantName && seat.occupantName ? `👤 ${seat.occupantName}` : `Poltrona ${num} — Ocupada`)
              : isSelected ? `✓ Poltrona ${num} — Selecionada` : `Poltrona ${num} — Livre`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const renderFloor = (floor: "superior" | "inferior") => {
    const isSup = floor === "superior";
    const totalRows = isSup ? 11 : 3;
    const start = isSup ? 1 : 45;

    return (
      <div className={`flex flex-col w-[48%] min-w-0`}>
        <div className={`bg-white rounded-[20px] border-2 border-slate-300 shadow-lg ${padding} flex flex-col gap-1 h-full`}>
          {/* Title */}
          <h3 className={`text-center ${titleSize} font-black text-sky-500 tracking-wider mb-1`}>
            {isSup ? "PISO SUPERIOR" : "PISO INFERIOR"}
          </h3>

          {/* Top arch */}
          <div className={`w-full ${archH} bg-slate-100 rounded-t-full border border-slate-200 mb-1 flex items-end justify-center pb-0.5`}>
            <div className="w-1 h-1 rounded-full bg-slate-400" />
          </div>

          {/* Driver/wheel for inferior */}
          {!isSup && (
            <div className="mb-2 flex flex-col items-center gap-1">
              <div className={`${compact ? "w-8 h-8" : "w-10 h-10"} rounded-full border-2 border-slate-300 flex items-center justify-center bg-slate-100`}>
                <div className={`${compact ? "w-3 h-3" : "w-4 h-4"} rounded-full border-2 border-slate-400`} />
              </div>
              <div className="w-full h-4 bg-slate-100 border border-slate-200 rounded" />
            </div>
          )}

          {/* Seat rows */}
          <div className={`grid grid-cols-5 ${gap}`}>
            {Array.from({ length: totalRows }).map((_, rowIdx) => {
              const rowStart = start + rowIdx * 4;
              const hasRight = isSup ? ![1, 2].includes(rowIdx) : true;

              return (
                <React.Fragment key={rowIdx}>
                  <div className="col-span-2 flex gap-1">
                    <SeatBtn num={rowStart.toString().padStart(2, "0")} />
                    <SeatBtn num={(rowStart + 1).toString().padStart(2, "0")} />
                  </div>
                  <div className="col-span-1" />
                  <div className="col-span-2 flex gap-1 justify-end">
                    {hasRight ? (
                      <>
                        <SeatBtn num={(rowStart + 3).toString().padStart(2, "0")} />
                        <SeatBtn num={(rowStart + 2).toString().padStart(2, "0")} />
                      </>
                    ) : (
                      <div className={`flex-1 bg-slate-100 border border-slate-200 rounded-lg opacity-60 flex items-center justify-center`}>
                        <span className="text-[8px] text-slate-400 font-bold">{rowIdx === 1 ? "🚪" : "🚻"}</span>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-row gap-3 w-full justify-center items-start">
      {renderFloor("superior")}
      {renderFloor("inferior")}
    </div>
  );
};
