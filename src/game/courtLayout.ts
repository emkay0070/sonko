import { CourtSize, CourtSquare, HopStep } from './types';

export function buildCourtSquares(courtSize: CourtSize): CourtSquare[] {
  if (courtSize === 5) {
    // 4 rows: 1 (single), 2-3 (double), 4 (single), 5 (home arch)
    const rows = [
      { row: 0, items: [{ id: 1, side: 'center' as const, isDouble: false, isHome: false }] },
      {
        row: 1,
        items: [
          { id: 2, side: 'left' as const, isDouble: true, isHome: false },
          { id: 3, side: 'right' as const, isDouble: true, isHome: false },
        ],
      },
      { row: 2, items: [{ id: 4, side: 'center' as const, isDouble: false, isHome: false }] },
      { row: 3, items: [{ id: 5, side: 'center' as const, isDouble: false, isHome: true }] },
    ];
    return layoutRows(rows);
  }

  // Classic 10-square Ugandan Sonko layout (8 rows):
  // 1 (single), 2 (single), 3 (single), 4-5 (double), 6 (single), 7-8 (double), 9 (single), 10 (home arch)
  const rows = [
    { row: 0, items: [{ id: 1, side: 'center' as const, isDouble: false, isHome: false }] },
    { row: 1, items: [{ id: 2, side: 'center' as const, isDouble: false, isHome: false }] },
    { row: 2, items: [{ id: 3, side: 'center' as const, isDouble: false, isHome: false }] },
    {
      row: 3,
      items: [
        { id: 4, side: 'left' as const, isDouble: true, isHome: false },
        { id: 5, side: 'right' as const, isDouble: true, isHome: false },
      ],
    },
    { row: 4, items: [{ id: 6, side: 'center' as const, isDouble: false, isHome: false }] },
    {
      row: 5,
      items: [
        { id: 7, side: 'left' as const, isDouble: true, isHome: false },
        { id: 8, side: 'right' as const, isDouble: true, isHome: false },
      ],
    },
    { row: 6, items: [{ id: 9, side: 'center' as const, isDouble: false, isHome: false }] },
    { row: 7, items: [{ id: 10, side: 'center' as const, isDouble: false, isHome: true }] },
  ];

  return layoutRows(rows);
}

interface RowSpec {
  row: number;
  items: { id: number; side: 'center' | 'left' | 'right'; isDouble: boolean; isHome: boolean }[];
}

function layoutRows(rows: RowSpec[]): CourtSquare[] {
  const squares: CourtSquare[] = [];
  const totalRows = rows.length;
  const topPad = 0.07;
  const bottomPad = 0.14;
  const usableHeight = 1 - topPad - bottomPad;
  const rowH = usableHeight / totalRows;

  const singleW = 0.34;
  const doubleW = 0.34;
  const homeW = 0.56;

  for (const r of rows) {
    // Row 0 is at the bottom (closest to baseline), highest row is at the top (Home)
    const y = 1 - bottomPad - (r.row + 1) * rowH;
    for (const item of r.items) {
      let w = singleW;
      let x = 0.5 - singleW / 2;
      if (item.isHome) {
        w = homeW;
        x = 0.5 - homeW / 2;
      } else if (item.side === 'left') {
        w = doubleW;
        x = 0.5 - doubleW;
      } else if (item.side === 'right') {
        w = doubleW;
        x = 0.5;
      }

      squares.push({
        id: item.id,
        row: r.row,
        side: item.side,
        isDouble: item.isDouble,
        isHome: item.isHome,
        x,
        y,
        w,
        h: rowH,
      });
    }
  }

  return squares;
}

export function getSquareCenter(sq: CourtSquare): { x: number; y: number } {
  return {
    x: sq.x + sq.w / 2,
    y: sq.y + sq.h / 2,
  };
}

/**
 * Evaluates where a thrown stone landed in normalized court space.
 */
export function evaluateStoneLanding(
  squares: CourtSquare[],
  nx: number,
  ny: number,
  targetSquareId: number,
  lineTolerance = 0.016
): {
  status: 'CLEAN' | 'BULLSEYE' | 'LINE_FOUL' | 'OUTSIDE_FOUL';
  landedSquareId: number | null;
} {
  const target = squares.find((s) => s.id === targetSquareId);
  if (!target) return { status: 'OUTSIDE_FOUL', landedSquareId: null };

  // Check inside target square
  const inX = nx >= target.x && nx <= target.x + target.w;
  const inY = ny >= target.y && ny <= target.y + target.h;

  if (inX && inY) {
    const distLeft = nx - target.x;
    const distRight = target.x + target.w - nx;
    const distTop = ny - target.y;
    const distBottom = target.y + target.h - ny;
    const minEdge = Math.min(distLeft, distRight, distTop, distBottom);

    if (minEdge < lineTolerance) {
      return { status: 'LINE_FOUL', landedSquareId: target.id };
    }

    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    const centerDist = Math.hypot(nx - cx, ny - cy);
    if (centerDist < Math.min(target.w, target.h) * 0.24) {
      return { status: 'BULLSEYE', landedSquareId: target.id };
    }
    return { status: 'CLEAN', landedSquareId: target.id };
  }

  // Check if it hit another square
  for (const sq of squares) {
    if (nx >= sq.x && nx <= sq.x + sq.w && ny >= sq.y && ny <= sq.y + sq.h) {
      return { status: 'OUTSIDE_FOUL', landedSquareId: sq.id };
    }
  }

  return { status: 'OUTSIDE_FOUL', landedSquareId: null };
}

/**
 * Evaluates a backward House-claiming toss over the shoulder.
 */
export function evaluateClaimLanding(
  squares: CourtSquare[],
  houses: Record<number, 0 | 1>,
  nx: number,
  ny: number,
  lineTolerance = 0.015
): {
  status: 'CLAIMED' | 'LINE_FOUL' | 'ALREADY_OWNED' | 'OUTSIDE_FOUL';
  squareId: number | null;
} {
  for (const sq of squares) {
    // Cannot claim Home square (10 or 5)
    if (sq.isHome) continue;
    if (nx >= sq.x && nx <= sq.x + sq.w && ny >= sq.y && ny <= sq.y + sq.h) {
      const minEdge = Math.min(
        nx - sq.x,
        sq.x + sq.w - nx,
        ny - sq.y,
        sq.y + sq.h - ny
      );
      if (minEdge < lineTolerance) {
        return { status: 'LINE_FOUL', squareId: sq.id };
      }
      if (houses[sq.id] !== undefined) {
        return { status: 'ALREADY_OWNED', squareId: sq.id };
      }
      return { status: 'CLAIMED', squareId: sq.id };
    }
  }
  return { status: 'OUTSIDE_FOUL', squareId: null };
}

/**
 * Computes the complete ordered hop sequence (outbound -> turnaround -> return with pickup -> exit)
 * for a given stone position, houses map, and active player.
 */
export function buildHopSequence(
  squares: CourtSquare[],
  stoneSquareId: number,
  houses: Record<number, 0 | 1>,
  playerIndex: 0 | 1
): { outSteps: HopStep[]; backSteps: HopStep[] } {
  const maxRow = Math.max(...squares.map((s) => s.row));
  const stoneSq = squares.find((s) => s.id === stoneSquareId);
  const stoneRow = stoneSq ? stoneSq.row : 0;

  const getLandableForRow = (row: number): { squares: number[]; stance: HopStep['stance'] } | null => {
    const rowSquares = squares.filter((s) => s.row === row).sort((a, b) => a.id - b.id);
    const valid = rowSquares.filter((sq) => {
      if (sq.id === stoneSquareId) return false;
      const owner = houses[sq.id];
      if (owner !== undefined && owner !== playerIndex) return false;
      return true;
    });

    if (valid.length === 0) return null;

    if (valid.length === 2) {
      return { squares: valid.map((v) => v.id), stance: 'TWO_FEET' };
    }

    const single = valid[0];
    if (houses[single.id] === playerIndex || single.isHome) {
      return { squares: [single.id], stance: 'HOUSE_REST' };
    }
    return { squares: [single.id], stance: 'ONE_FOOT' };
  };

  const outSteps: HopStep[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const land = getLandableForRow(r);
    if (land) {
      outSteps.push({
        row: r,
        squares: land.squares,
        stance: land.stance,
        leg: 'OUT',
      });
    }
  }

  // Turn around at the last outbound step!
  const turnRow = outSteps.length > 0 ? outSteps[outSteps.length - 1].row : maxRow;

  // Special case: stone is in the Home row (so turnRow < stoneRow)
  if (stoneRow > turnRow && outSteps.length > 0) {
    outSteps[outSteps.length - 1].triggersPickupAfterLand = true;
  }

  const backSteps: HopStep[] = [];
  for (let r = turnRow - 1; r >= 0; r--) {
    const land = getLandableForRow(r);
    if (land) {
      backSteps.push({
        row: r,
        squares: land.squares,
        stance: land.stance,
        leg: 'BACK',
      });
    }
  }

  // Determine which return step triggers pickup if not already triggered at turnRow
  if (stoneRow <= turnRow) {
    // If stoneRow itself is a landable double-row (e.g., stone in 4, player lands in 5 on return),
    // trigger pickup right when landing on that same row during return!
    const sameRowReturnIdx = backSteps.findIndex((st) => st.row === stoneRow);
    if (sameRowReturnIdx !== -1) {
      backSteps[sameRowReturnIdx].triggersPickupAfterLand = true;
    } else {
      // Otherwise, trigger pickup on the return step immediately BEFORE stoneRow (i.e. lowest row > stoneRow)
      let pickupIdx = -1;
      for (let i = backSteps.length - 1; i >= 0; i--) {
        if (backSteps[i].row > stoneRow) {
          pickupIdx = i;
          break;
        }
      }
      if (pickupIdx !== -1) {
        backSteps[pickupIdx].triggersPickupAfterLand = true;
      } else if (outSteps.length > 0) {
        // Fallback: if no return step exists above stoneRow, trigger on turnRow
        outSteps[outSteps.length - 1].triggersPickupAfterLand = true;
      }
    }
  }

  return { outSteps, backSteps };
}
