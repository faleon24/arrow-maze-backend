import 'dotenv/config';
import { PrismaService } from '../src/infrastructure/persistence/prisma.service';
import { PostgresLevelRepository } from '../src/infrastructure/persistence/postgres-level.repository';
import { Level } from '../src/domain/models/level';
import { BoardLayout } from '../src/domain/models/board-layout';
import { ArrowPathInfo } from '../src/domain/models/arrow-path-info';
import { HardProfile } from '../src/domain/models/difficulty-profile';
import { BoardSolver } from '../src/domain/services/board-solver';

// ===========================================================================
// Curated catalog — 7 showcase levels, all multi-cell serpent figures.
// ===========================================================================
//
// The catalog was trimmed to the best-designed boards only: five new
// figure levels (Skull, Cat, Rabbit, Butterfly, Invader) plus the two
// flagships (Heartbreaker, Leviathan), hardest last.
//
// The five new figures were AUTHORED OFFLINE (see HANDOFF_HEX_3 §3b): a
// silhouette is rasterized in hex screen space (x = col + 0.5*(row%2),
// y = 0.866*row) so the figure renders true on the pointy-top odd-r
// board; the mask is partitioned into winding multi-cell serpents; and an
// annealer searches path orientations until the greedy peel clears the
// whole board WITH every head equal to its last drawn segment — so no
// sideways arrowheads, unlike the reverted in-seed snake generator.
//
// Each arrow is a polyline whose `direction` is the label of its LAST
// segment. BoardSolver skips an arrow's own cells when ray-tracing, so a
// coil may bury its own head. Difficulty is pure ordering: of the n! tap
// orders only a handful clear the board. Every board is re-verified by
// BoardSolver.isSolvable at seed time — a typo fails the seed instead of
// shipping a broken level.

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface ShowcaseSpec {
  name: string;
  uuid: string;
  difficulty: Difficulty;
  rows: number;
  cols: number;
  parTimeMs: number;
  arrows: Array<{ color: string; direction: string; cells: string[] }>;
}

const showcase: ShowcaseSpec[] = [
  {
    name: 'Skull',
    uuid: '5eed0000-0000-4000-8000-00000000000d',
    difficulty: 'HARD',
    rows: 18,
    cols: 13,
    parTimeMs: 165000,
    arrows: [
      { color: 'PURPLE', direction: 'SW', cells: ['9,2', '10,2', '10,1', '11,1', '11,2', '12,3', '13,3', '14,4', '15,3', '16,4', '17,3'] },
      { color: 'YELLOW', direction: 'SE', cells: ['4,1', '5,1', '6,1', '7,0', '7,1', '8,1', '9,1'] },
      { color: 'PURPLE', direction: 'SW', cells: ['5,11', '4,12', '3,11', '4,11', '4,10', '3,10', '2,10', '1,9', '1,8', '2,9', '3,9', '4,9', '3,8', '4,8'] },
      { color: 'PURPLE', direction: 'NW', cells: ['1,4', '2,4', '1,3', '2,3', '3,3', '4,4', '4,3', '3,2', '4,2', '3,1'] },
      { color: 'PURPLE', direction: 'W', cells: ['14,8', '15,7', '15,6', '15,5', '16,6', '16,7', '17,7', '17,6', '17,5'] },
      { color: 'BLUE', direction: 'SE', cells: ['12,5', '13,4', '13,5', '14,5', '14,6', '13,6', '14,7', '13,7', '12,8', '13,8', '13,9', '14,9', '15,9', '16,9', '17,9'] },
      { color: 'PINK', direction: 'SE', cells: ['11,8', '10,8', '9,7', '8,7', '9,6', '8,6', '9,5', '10,5', '11,4', '10,4', '10,3', '11,3', '12,4'] },
      { color: 'YELLOW', direction: 'W', cells: ['12,9', '12,10', '11,9', '11,10', '11,11', '10,11', '10,12', '9,11', '9,10', '10,10', '10,9'] },
      { color: 'BLUE', direction: 'NE', cells: ['8,12', '7,12', '7,11', '6,12'] },
      { color: 'YELLOW', direction: 'SE', cells: ['4,5', '5,5', '5,6', '5,7', '6,7', '6,6', '7,6'] },
      { color: 'GREEN', direction: 'NE', cells: ['3,4', '2,5', '1,5', '1,6', '1,7', '2,8', '3,7', '4,7', '4,6', '3,5', '2,6', '3,6', '2,7'] },
    ],
  },
  {
    name: 'Cat',
    uuid: '5eed0000-0000-4000-8000-00000000000e',
    difficulty: 'HARD',
    rows: 16,
    cols: 12,
    parTimeMs: 180000,
    arrows: [
      { color: 'PURPLE', direction: 'E', cells: ['7,3', '7,2', '7,1', '8,2', '8,1', '7,0', '6,1', '5,0', '4,1', '3,1', '3,2', '2,3', '2,2', '2,1', '1,1', '1,2'] },
      { color: 'PURPLE', direction: 'SE', cells: ['2,9', '2,10', '1,9', '1,10', '2,11', '3,10', '4,11', '5,11'] },
      { color: 'GREEN', direction: 'W', cells: ['13,1', '13,2', '13,3', '14,3', '14,4', '14,5', '14,6', '14,7', '14,8', '14,9', '15,8', '15,7', '15,6', '15,5', '15,4', '15,3'] },
      { color: 'BLUE', direction: 'SW', cells: ['11,4', '10,5', '10,4', '10,3', '10,2', '9,1', '10,1'] },
      { color: 'PURPLE', direction: 'SW', cells: ['12,7', '13,7', '13,6', '13,5', '12,5', '13,4', '12,4', '11,3', '12,3', '11,2', '12,2', '11,1', '12,1'] },
      { color: 'PINK', direction: 'W', cells: ['5,3', '6,3', '5,2', '6,2', '5,1', '4,2', '4,3', '4,4', '4,5', '3,4', '3,3'] },
      { color: 'YELLOW', direction: 'SW', cells: ['10,11', '9,10', '8,11', '8,10', '7,9', '7,8', '7,7', '8,7'] },
      { color: 'BLUE', direction: 'NE', cells: ['6,10', '6,9', '6,8', '6,7', '7,6', '6,6', '5,6', '4,6', '5,5', '6,5', '7,4', '6,4', '5,4'] },
      { color: 'PINK', direction: 'SW', cells: ['11,5', '11,6', '10,6', '9,5', '9,6', '8,6', '7,5', '8,5'] },
      { color: 'PINK', direction: 'W', cells: ['7,10', '7,11', '6,11', '5,10', '4,10', '3,9', '3,8', '3,7', '4,7', '5,7', '4,8', '4,9', '5,9', '5,8'] },
      { color: 'BLUE', direction: 'W', cells: ['12,9', '12,10', '12,11', '13,10', '13,9', '13,8', '12,8', '11,7', '10,8', '10,7'] },
      { color: 'PINK', direction: 'SE', cells: ['11,8', '11,9', '10,9', '10,10', '11,10'] },
    ],
  },
  {
    name: 'Rabbit',
    uuid: '5eed0000-0000-4000-8000-00000000000f',
    difficulty: 'HARD',
    rows: 21,
    cols: 11,
    parTimeMs: 195000,
    arrows: [
      { color: 'YELLOW', direction: 'NW', cells: ['15,0', '14,1', '14,0', '13,0', '13,1', '12,1', '12,2', '11,2', '11,1', '10,2', '10,1', '9,1', '8,1', '7,1', '6,1'] },
      { color: 'YELLOW', direction: 'SE', cells: ['2,9', '1,8', '1,7', '2,7', '2,8', '3,7', '4,7', '5,7'] },
      { color: 'GREEN', direction: 'SW', cells: ['6,9', '5,8', '4,9', '3,8', '4,8'] },
      { color: 'PURPLE', direction: 'NE', cells: ['19,2', '18,2', '17,1', '17,0', '16,1', '16,2', '16,3', '15,3', '15,2', '15,1', '14,2'] },
      { color: 'PINK', direction: 'E', cells: ['9,2', '9,3', '9,4', '10,4', '10,3', '11,3', '11,4', '12,5', '13,4', '13,5'] },
      { color: 'PURPLE', direction: 'W', cells: ['1,2', '2,3', '3,2', '4,3', '4,2', '4,1', '5,1', '5,2', '6,2', '6,3', '7,2', '8,3', '8,2'] },
      { color: 'YELLOW', direction: 'SW', cells: ['2,1', '1,1', '2,2', '3,1'] },
      { color: 'BLUE', direction: 'NE', cells: ['20,6', '20,5', '20,4', '19,3', '18,3', '17,2', '17,3', '16,4', '15,4', '14,5'] },
      { color: 'GREEN', direction: 'E', cells: ['11,5', '10,5', '9,5', '10,6', '11,6', '10,7', '9,6', '8,7', '9,7', '8,8', '8,9'] },
      { color: 'BLUE', direction: 'E', cells: ['9,8', '10,9', '10,8', '11,7', '11,8', '12,8', '12,9'] },
      { color: 'BLUE', direction: 'E', cells: ['6,7', '6,8', '7,7', '7,8'] },
      { color: 'GREEN', direction: 'NW', cells: ['17,9', '17,8', '18,8', '19,7', '19,6', '19,5', '19,4', '18,4', '17,4', '18,5', '18,6', '18,7', '17,7', '16,7'] },
      { color: 'YELLOW', direction: 'SE', cells: ['17,6', '16,6', '17,5', '16,5', '15,5', '15,6', '15,7', '16,8', '15,8', '16,9', '15,9', '14,9', '14,8', '13,8', '13,9', '14,10'] },
    ],
  },
  {
    name: 'Butterfly',
    uuid: '5eed0000-0000-4000-8000-000000000010',
    difficulty: 'HARD',
    rows: 20,
    cols: 19,
    parTimeMs: 255000,
    arrows: [
      { color: 'YELLOW', direction: 'W', cells: ['9,5', '8,5', '9,4', '10,5', '10,4', '10,3', '10,2', '10,1'] },
      { color: 'YELLOW', direction: 'E', cells: ['1,6', '1,7', '2,8', '3,8', '3,9', '2,10', '1,10', '1,11'] },
      { color: 'GREEN', direction: 'SW', cells: ['13,6', '13,5', '13,4', '14,4', '14,5', '14,6', '15,5', '15,6', '16,6', '17,5'] },
      { color: 'PINK', direction: 'W', cells: ['5,14', '4,15', '5,15', '5,16', '6,16', '6,17', '7,16', '7,17', '8,17', '8,18', '9,17', '9,16', '10,17', '10,16', '10,15'] },
      { color: 'PURPLE', direction: 'NE', cells: ['9,1', '9,0', '8,0', '8,1', '7,0', '7,1', '6,1', '6,2', '5,1', '5,2', '4,3'] },
      { color: 'GREEN', direction: 'SW', cells: ['10,14', '10,13', '9,13', '8,13', '9,12', '10,12', '10,11', '9,11', '8,12', '7,12', '6,13', '5,13', '4,14', '4,13', '5,12'] },
      { color: 'PINK', direction: 'NW', cells: ['11,9', '12,9', '13,9', '13,8', '14,9', '15,8', '15,7', '14,7'] },
      { color: 'PINK', direction: 'SE', cells: ['18,7', '18,6', '18,5', '17,4', '17,3', '17,2', '18,3', '18,4', '19,4'] },
      { color: 'YELLOW', direction: 'SW', cells: ['6,12', '7,11', '8,11', '9,10', '9,9', '9,8', '10,9', '11,8'] },
      { color: 'PURPLE', direction: 'NE', cells: ['5,8', '4,9', '5,9', '6,9', '7,8', '7,9', '8,9', '8,10', '7,10', '6,11', '5,11'] },
      { color: 'BLUE', direction: 'W', cells: ['13,3', '13,2', '14,3', '14,2', '15,1', '15,2', '16,3', '16,2'] },
      { color: 'BLUE', direction: 'SW', cells: ['18,9', '17,8', '17,9', '16,9', '16,8', '17,7', '16,7', '17,6'] },
      { color: 'PINK', direction: 'NE', cells: ['5,3', '4,4', '4,5', '5,4', '5,5', '5,6', '6,7', '6,6', '6,5', '7,5', '8,6', '7,6'] },
      { color: 'GREEN', direction: 'E', cells: ['19,13', '18,13', '18,12', '18,11', '17,10', '17,11', '17,12', '17,13', '18,14', '18,15', '17,14', '17,15'] },
      { color: 'BLUE', direction: 'SE', cells: ['16,15', '16,16', '15,16', '15,15', '14,16', '13,15', '14,15', '13,14', '14,14', '13,13', '13,12', '14,13'] },
      { color: 'BLUE', direction: 'W', cells: ['8,7', '7,7', '8,8', '9,7', '9,6', '10,7', '10,6'] },
      { color: 'YELLOW', direction: 'SW', cells: ['15,9', '16,10', '15,10', '16,11', '16,12', '15,12', '15,11', '14,12', '13,11', '14,11'] },
    ],
  },
  {
    name: 'Invader',
    uuid: '5eed0000-0000-4000-8000-000000000011',
    difficulty: 'HARD',
    rows: 22,
    cols: 19,
    parTimeMs: 330000,
    arrows: [
      { color: 'PINK', direction: 'W', cells: ['0,7', '0,8', '0,9', '0,10', '0,11', '1,10', '1,9', '1,8', '1,7'] },
      { color: 'GREEN', direction: 'NE', cells: ['19,4', '19,3', '19,2', '18,2', '18,1', '18,0', '17,0', '16,0', '16,1', '17,1', '16,2'] },
      { color: 'YELLOW', direction: 'SE', cells: ['20,3', '21,2', '21,3', '20,4', '21,4'] },
      { color: 'BLUE', direction: 'SE', cells: ['15,4', '15,3', '15,2', '14,3', '14,4', '13,3', '13,4', '13,5', '13,6', '14,7'] },
      { color: 'PINK', direction: 'E', cells: ['18,17', '18,18', '17,17', '17,16', '16,17', '16,18'] },
      { color: 'YELLOW', direction: 'SW', cells: ['8,18', '8,17', '9,17', '10,18', '10,17', '11,17', '12,18', '13,17', '12,17', '11,16', '12,16', '13,16', '14,16'] },
      { color: 'GREEN', direction: 'E', cells: ['15,7', '15,8', '15,9', '15,10', '14,11', '14,10', '14,9', '14,8', '13,7', '13,8', '13,9', '13,10', '13,11'] },
      { color: 'PINK', direction: 'SE', cells: ['9,16', '10,16', '11,15', '10,15', '10,14', '11,14', '12,15'] },
      { color: 'BLUE', direction: 'E', cells: ['19,14', '19,15', '20,16', '21,15', '21,14', '20,14', '20,15'] },
      { color: 'YELLOW', direction: 'W', cells: ['13,0', '12,0', '11,0', '10,0', '9,0', '8,1', '8,0'] },
      { color: 'PURPLE', direction: 'E', cells: ['11,11', '11,12', '12,12', '13,12', '12,13', '11,13', '12,14', '13,13', '13,14', '13,15', '14,15', '14,14', '15,14', '15,15'] },
      { color: 'PINK', direction: 'SW', cells: ['12,1', '11,1', '10,2', '9,2', '8,3', '7,3', '6,4', '6,3', '7,2', '8,2', '9,1', '10,1'] },
      { color: 'BLUE', direction: 'NW', cells: ['3,13', '3,12', '4,13', '5,13', '5,12', '4,12', '3,11'] },
      { color: 'BLUE', direction: 'SW', cells: ['4,5', '3,5', '3,6', '2,7', '2,8', '3,7', '4,7', '4,6', '5,5', '6,5'] },
      { color: 'PURPLE', direction: 'W', cells: ['9,3', '10,3', '11,3', '12,4', '12,3', '11,2', '12,2', '13,2', '13,1'] },
      { color: 'YELLOW', direction: 'E', cells: ['8,4', '9,4', '10,4', '11,4', '11,5', '12,5', '12,6', '12,7', '12,8', '12,9', '11,9', '10,10', '10,11', '11,10', '12,10', '12,11'] },
      { color: 'BLUE', direction: 'SW', cells: ['8,11', '9,10', '9,9', '8,9', '8,8', '8,7', '9,7', '9,8', '10,9', '10,8', '11,8', '11,7', '10,7', '11,6'] },
      { color: 'GREEN', direction: 'W', cells: ['6,12', '7,12', '7,11', '7,10', '8,10', '7,9', '7,8', '7,7', '7,6', '6,6', '7,5', '7,4'] },
      { color: 'YELLOW', direction: 'E', cells: ['5,6', '6,7', '6,8', '5,7', '4,8', '5,8', '6,9', '6,10', '6,11'] },
      { color: 'PURPLE', direction: 'E', cells: ['9,14', '8,14', '8,15', '9,15', '8,16', '7,15', '7,14', '7,13', '6,13', '6,14', '6,15', '6,16'] },
      { color: 'PURPLE', direction: 'E', cells: ['3,8', '4,9', '5,9', '4,10', '4,11', '5,10', '5,11'] },
      { color: 'GREEN', direction: 'NW', cells: ['2,11', '3,10', '2,10', '3,9', '2,9'] },
    ],
  },
  {
    name: 'Heartbreaker',
    uuid: '5eed0000-0000-4000-8000-00000000000c',
    difficulty: 'HARD',
    rows: 14,
    cols: 17,
    parTimeMs: 456000,
    arrows: [
      { color: 'PINK', direction: 'NE', cells: ['0,2', '1,2', '1,1', '2,1', '3,1', '4,1', '3,0', '4,0', '5,0', '6,1', '6,2', '5,1', '4,2'] },
      { color: 'PURPLE', direction: 'NW', cells: ['6,4', '6,3', '7,2', '8,3', '7,3', '7,4', '8,5', '8,4', '9,4', '10,5', '10,6', '9,5'] },
      { color: 'PINK', direction: 'NE', cells: ['5,16', '4,16', '4,15', '4,14', '5,13', '5,12', '6,13', '6,12', '5,11', '4,12', '4,13', '3,13', '2,14'] },
      { color: 'YELLOW', direction: 'SE', cells: ['0,11', '0,12', '1,12', '2,12', '1,11', '1,10', '2,10', '2,11', '3,11', '3,10', '4,10', '5,9', '6,10'] },
      { color: 'GREEN', direction: 'SE', cells: ['5,10', '6,11', '7,11', '7,10', '8,10', '9,10'] },
      { color: 'GREEN', direction: 'NE', cells: ['1,6', '2,7', '3,6', '4,7', '3,7', '2,8', '2,9', '3,9', '3,8', '4,8', '5,7', '5,8', '4,9'] },
      { color: 'PINK', direction: 'NE', cells: ['10,9', '10,8', '9,7', '8,7', '7,7'] },
      { color: 'BLUE', direction: 'W', cells: ['2,16', '3,16', '3,15'] },
      { color: 'PURPLE', direction: 'SE', cells: ['2,5', '3,4', '4,4', '4,3', '3,2', '3,3', '2,4', '1,4', '1,5', '2,6', '3,5', '4,6'] },
      { color: 'BLUE', direction: 'SE', cells: ['5,3', '5,4', '4,5', '5,5', '6,5', '6,6', '6,7', '7,6', '7,5', '8,6', '9,6', '10,7', '11,7'] },
      { color: 'YELLOW', direction: 'SW', cells: ['11,6', '12,7', '12,8', '11,8', '11,9', '12,9'] },
      { color: 'BLUE', direction: 'E', cells: ['0,3', '0,4', '0,5'] },
      { color: 'YELLOW', direction: 'NE', cells: ['2,2', '2,3', '1,3'] },
      { color: 'GREEN', direction: 'SE', cells: ['2,0'] },
      { color: 'PURPLE', direction: 'SW', cells: ['2,13', '3,12'] },
      { color: 'BLUE', direction: 'SE', cells: ['4,11'] },
      { color: 'GREEN', direction: 'SE', cells: ['5,2'] },
      { color: 'YELLOW', direction: 'NE', cells: ['5,6'] },
      { color: 'GREEN', direction: 'NW', cells: ['6,14', '6,15', '5,14'] },
      { color: 'BLUE', direction: 'NW', cells: ['5,15'] },
      { color: 'PINK', direction: 'NW', cells: ['8,9', '7,9', '6,9'] },
      { color: 'PURPLE', direction: 'W', cells: ['7,12'] },
      { color: 'PINK', direction: 'NE', cells: ['8,11'] },
      { color: 'PURPLE', direction: 'NE', cells: ['9,12'] },
      { color: 'PINK', direction: 'SW', cells: ['13,8'] },
      { color: 'YELLOW', direction: 'SE', cells: ['6,8', '7,8'] },
      { color: 'BLUE', direction: 'SW', cells: ['7,14', '7,13', '8,13', '8,12', '9,11'] },
      { color: 'YELLOW', direction: 'SW', cells: ['2,15', '3,14'] },
      { color: 'GREEN', direction: 'E', cells: ['1,15', '1,14', '1,13', '0,13', '0,14'] },
      { color: 'PURPLE', direction: 'SE', cells: ['8,8', '9,8', '9,9', '10,10'] },
      { color: 'PINK', direction: 'SW', cells: ['10,11', '11,10'] },
    ],
  },
  {
    name: 'Leviathan',
    uuid: '5eed0000-0000-4000-8000-00000000000b',
    difficulty: 'HARD',
    rows: 16,
    cols: 16,
    parTimeMs: 765000,
    arrows: [
      { color: 'PURPLE', direction: 'SE', cells: ['2,0', '1,0', '0,1', '0,2', '1,2', '1,3', '0,3', '0,4', '1,4', '0,5', '0,6', '1,6'] },
      { color: 'YELLOW', direction: 'NE', cells: ['7,9', '6,9', '5,9', '5,10', '6,10', '7,10', '7,11', '6,11', '5,11', '4,12', '3,11', '3,10', '2,11'] },
      { color: 'PINK', direction: 'SW', cells: ['0,13', '0,14', '1,13', '1,12', '1,11', '2,12', '2,13', '2,14', '1,14', '0,15', '1,15', '2,15', '3,14'] },
      { color: 'PURPLE', direction: 'SW', cells: ['9,9', '8,10', '8,11', '8,12', '7,12', '6,13', '6,12', '5,12', '4,13', '3,12', '3,13', '4,14', '5,14', '6,14'] },
      { color: 'PINK', direction: 'SW', cells: ['11,13', '11,12', '10,13', '9,13', '10,14', '10,15', '9,15', '8,15', '8,14', '8,13', '9,12', '9,11', '10,11'] },
      { color: 'GREEN', direction: 'SE', cells: ['14,14', '14,15', '13,14', '13,15', '12,15', '11,14', '12,14', '13,13', '13,12', '12,12', '11,11', '11,10', '12,11'] },
      { color: 'GREEN', direction: 'SW', cells: ['15,2', '15,1', '14,2', '13,1', '12,2', '12,3', '11,2', '10,3', '9,3', '8,4', '7,3', '7,2', '8,3', '9,2'] },
      { color: 'YELLOW', direction: 'SW', cells: ['9,0', '8,1', '7,1', '6,1', '5,1', '6,2', '6,3', '6,4', '5,4', '4,5', '3,4', '2,4', '3,3', '4,4', '5,3', '5,2', '4,3', '3,2', '2,3', '2,2', '3,1'] },
      { color: 'BLUE', direction: 'E', cells: ['14,8', '15,8', '15,9', '14,10', '14,9', '13,9', '13,10', '14,11', '15,11', '15,12', '14,13', '15,13', '15,14'] },
      { color: 'PINK', direction: 'NE', cells: ['8,0', '7,0', '6,0', '5,0', '4,0', '4,1', '3,0', '2,1', '1,1'] },
      { color: 'PINK', direction: 'NE', cells: ['10,7', '9,6', '8,7', '8,8', '8,9', '7,8', '7,7', '7,6', '8,6', '8,5', '7,4', '6,5', '5,5', '4,6'] },
      { color: 'BLUE', direction: 'NW', cells: ['5,6', '4,7', '3,7', '2,7', '1,7', '1,8', '1,9', '2,10', '3,9', '4,10', '4,9', '3,8'] },
      { color: 'BLUE', direction: 'SE', cells: ['11,8', '10,9', '9,8', '9,7', '10,8', '11,7', '12,8', '12,7', '11,6', '10,6', '11,5', '12,6', '13,6'] },
      { color: 'YELLOW', direction: 'SW', cells: ['9,5', '9,4', '10,4', '11,3'] },
      { color: 'YELLOW', direction: 'SE', cells: ['9,10', '10,10', '11,9', '12,10'] },
      { color: 'BLUE', direction: 'NE', cells: ['15,5', '15,4', '15,3', '14,4'] },
      { color: 'YELLOW', direction: 'NE', cells: ['7,13', '7,14', '7,15', '6,15', '5,15', '4,15', '3,15'] },
      { color: 'GREEN', direction: 'NE', cells: ['0,7', '0,8', '0,9', '0,10', '1,10', '0,11'] },
      { color: 'GREEN', direction: 'SE', cells: ['0,0'] },
      { color: 'BLUE', direction: 'E', cells: ['0,12'] },
      { color: 'BLUE', direction: 'SW', cells: ['11,15'] },
      { color: 'GREEN', direction: 'SE', cells: ['12,0'] },
      { color: 'PURPLE', direction: 'NE', cells: ['15,10'] },
      { color: 'PINK', direction: 'SW', cells: ['15,15'] },
      { color: 'GREEN', direction: 'SW', cells: ['1,5', '2,6', '3,5'] },
      { color: 'PINK', direction: 'NW', cells: ['2,5'] },
      { color: 'YELLOW', direction: 'SE', cells: ['2,9'] },
      { color: 'PURPLE', direction: 'NW', cells: ['3,6'] },
      { color: 'GREEN', direction: 'W', cells: ['4,2'] },
      { color: 'PURPLE', direction: 'NE', cells: ['5,8', '6,8', '6,7', '5,7', '4,8'] },
      { color: 'PURPLE', direction: 'NW', cells: ['4,11'] },
      { color: 'BLUE', direction: 'E', cells: ['5,13'] },
      { color: 'GREEN', direction: 'NE', cells: ['7,5', '6,6'] },
      { color: 'BLUE', direction: 'SW', cells: ['8,2', '9,1', '10,1'] },
      { color: 'PURPLE', direction: 'NE', cells: ['9,14'] },
      { color: 'YELLOW', direction: 'SW', cells: ['10,2', '11,1'] },
      { color: 'PURPLE', direction: 'SW', cells: ['10,5', '11,4'] },
      { color: 'BLUE', direction: 'E', cells: ['10,12'] },
      { color: 'YELLOW', direction: 'E', cells: ['12,13'] },
      { color: 'PINK', direction: 'SE', cells: ['13,11', '14,12'] },
      { color: 'GREEN', direction: 'NE', cells: ['15,7', '14,7', '13,7', '13,8', '12,9'] },
      { color: 'PURPLE', direction: 'SW', cells: ['10,0', '11,0', '12,1', '13,0'] },
      { color: 'PINK', direction: 'SW', cells: ['14,0', '14,1', '15,0'] },
      { color: 'PINK', direction: 'W', cells: ['15,6', '14,6', '13,5', '14,5', '13,4', '12,5', '12,4'] },
      { color: 'YELLOW', direction: 'SE', cells: ['13,3', '13,2', '14,3'] },
    ],
  },
  {
    name: 'Maelstrom',
    uuid: '5eed0000-0000-4000-8000-000000000012',
    difficulty: 'HARD',
    rows: 17,
    cols: 17,
    parTimeMs: 360000,
    arrows: [
      { color: 'PINK', direction: 'NW', cells: ['0,12', '0,13', '0,14', '0,15', '0,16', '1,16', '1,15', '1,14', '1,13', '1,12', '1,11', '0,11'] },
      { color: 'GREEN', direction: 'W', cells: ['16,10', '16,9', '16,8', '16,7', '16,6', '16,5', '16,4', '16,3', '16,2', '16,1', '16,0'] },
      { color: 'YELLOW', direction: 'W', cells: ['5,16', '4,16', '3,16', '2,16', '2,15', '3,15', '3,14', '2,14', '2,13', '2,12'] },
      { color: 'YELLOW', direction: 'W', cells: ['16,13', '16,12', '16,11', '15,10', '15,9', '15,8', '15,7', '15,6', '15,5', '15,4', '15,3', '15,2', '15,1', '15,0'] },
      { color: 'PINK', direction: 'E', cells: ['14,9', '14,10', '14,11', '14,12', '15,11', '15,12', '15,13', '16,14', '16,15'] },
      { color: 'PURPLE', direction: 'SW', cells: ['13,14', '12,14', '12,13', '12,12', '12,11', '12,10', '13,9', '13,10', '13,11', '13,12', '13,13', '14,13', '14,14', '15,14', '15,15', '15,16', '16,16'] },
      { color: 'GREEN', direction: 'W', cells: ['14,6', '14,5', '14,4', '14,3', '14,2', '14,1', '14,0'] },
      { color: 'PINK', direction: 'SE', cells: ['11,16', '10,16', '9,16', '8,16', '7,16', '6,16', '7,15', '6,15', '5,15', '4,15', '5,14', '4,14', '3,13', '3,12', '4,13', '5,13', '6,14', '7,14'] },
      { color: 'PINK', direction: 'NE', cells: ['0,0', '0,1', '1,0', '2,0', '2,1', '1,1', '0,2'] },
      { color: 'BLUE', direction: 'SW', cells: ['14,8', '14,7', '13,7', '13,8', '12,9', '12,8', '12,7', '13,6'] },
      { color: 'BLUE', direction: 'NE', cells: ['12,15', '11,15', '12,16', '13,16', '14,16', '14,15', '13,15'] },
      { color: 'BLUE', direction: 'NE', cells: ['3,11', '2,11', '1,10', '0,10', '0,9', '0,8', '0,7', '0,6', '0,5', '0,4', '1,3', '2,3', '2,2', '1,2', '0,3'] },
      { color: 'YELLOW', direction: 'SW', cells: ['11,12', '11,11', '11,10', '11,9', '11,8', '11,7', '11,6', '12,6', '13,5'] },
      { color: 'GREEN', direction: 'W', cells: ['11,13', '11,14', '10,15', '9,15', '8,15', '9,14', '10,14', '10,13', '10,12', '10,11'] },
      { color: 'GREEN', direction: 'W', cells: ['1,4', '1,5', '1,6', '1,7', '1,8', '1,9', '2,10', '3,10', '4,11', '4,12', '5,12', '5,11', '5,10', '4,10', '3,9', '2,9', '2,8'] },
      { color: 'PURPLE', direction: 'SW', cells: ['4,0', '3,0', '3,1', '4,1', '5,0', '6,0', '6,1', '7,0', '8,0', '8,1', '9,0'] },
      { color: 'YELLOW', direction: 'NE', cells: ['11,1', '12,2', '13,2', '13,1', '12,1', '13,0', '12,0', '11,0', '10,0', '10,1', '9,1', '8,2', '7,2', '7,1', '6,2', '5,1', '4,2', '3,2'] },
      { color: 'PINK', direction: 'SW', cells: ['6,11', '6,10', '5,9', '5,8', '5,7', '4,7', '4,8', '4,9', '3,8', '3,7', '3,6', '2,7', '2,6', '2,5', '2,4', '3,3', '4,3', '5,2'] },
      { color: 'BLUE', direction: 'SE', cells: ['9,13', '8,14', '7,13', '6,13', '6,12', '7,12', '8,13'] },
      { color: 'PURPLE', direction: 'SW', cells: ['9,12', '9,11', '8,12', '7,11', '8,11', '7,10', '8,10', '9,10', '10,10', '10,9', '9,9', '9,8', '10,8', '10,7', '9,7', '9,6', '10,6', '11,5'] },
      { color: 'PINK', direction: 'NW', cells: ['13,3', '13,4', '12,5', '12,4', '12,3', '11,2', '10,2'] },
      { color: 'YELLOW', direction: 'NW', cells: ['4,5', '4,4', '3,4', '3,5', '4,6', '5,6', '6,7', '6,8', '7,7', '8,7', '8,8', '7,8', '8,9', '7,9', '6,9'] },
      { color: 'BLUE', direction: 'NW', cells: ['7,6', '6,6', '5,5', '5,4', '5,3', '6,3', '6,4', '6,5', '7,5', '8,6', '9,5', '10,5', '11,4', '11,3', '10,3'] },
      { color: 'GREEN', direction: 'SW', cells: ['10,4', '9,3', '9,4', '8,4', '8,5', '7,4', '7,3', '8,3', '9,2'] },
    ],
  },
  {
    name: 'Juggernaut',
    uuid: '5eed0000-0000-4000-8000-000000000013',
    difficulty: 'HARD',
    rows: 19,
    cols: 18,
    parTimeMs: 435000,
    arrows: [
      { color: 'BLUE', direction: 'W', cells: ['18,13', '18,12', '18,11', '18,10', '18,9', '18,8', '18,7', '18,6', '18,5', '18,4', '18,3', '18,2', '18,1'] },
      { color: 'YELLOW', direction: 'SW', cells: ['18,0', '17,0', '16,0', '15,0', '14,0', '13,0', '12,1', '11,1', '10,2', '9,1', '8,1', '8,0', '9,0', '10,1', '10,0', '11,0', '12,0'] },
      { color: 'PURPLE', direction: 'NW', cells: ['17,6', '17,5', '17,4', '17,3', '17,2', '16,2', '17,1', '16,1', '15,1', '14,1', '13,1', '12,2', '11,2', '10,3', '9,3', '8,3', '9,2', '8,2'] },
      { color: 'PURPLE', direction: 'SE', cells: ['1,14', '0,14', '0,15', '1,15', '1,16', '0,16', '0,17', '1,17', '2,17', '3,17', '4,17', '5,17'] },
      { color: 'PINK', direction: 'W', cells: ['16,7', '16,8', '16,9', '16,10', '16,11', '16,12', '16,13', '16,14', '17,14', '18,15', '18,14', '17,13', '17,12', '17,11', '17,10', '17,9', '17,8', '17,7'] },
      { color: 'GREEN', direction: 'NE', cells: ['17,15', '17,16', '18,16', '18,17', '17,17', '16,17', '15,17'] },
      { color: 'PINK', direction: 'W', cells: ['5,0', '4,1', '4,0', '3,0', '2,0', '1,0', '0,1', '0,0'] },
      { color: 'BLUE', direction: 'W', cells: ['15,14', '15,15', '14,16', '13,16', '13,17', '14,17', '15,16', '16,16', '16,15'] },
      { color: 'GREEN', direction: 'NE', cells: ['0,6', '0,5', '0,4', '0,3', '0,2', '1,1', '2,1', '3,1', '2,2', '1,2'] },
      { color: 'GREEN', direction: 'NW', cells: ['7,2', '7,1', '7,0', '6,0', '6,1', '6,2', '5,1'] },
      { color: 'GREEN', direction: 'W', cells: ['15,7', '15,6', '16,6', '16,5', '16,4', '16,3'] },
      { color: 'BLUE', direction: 'NW', cells: ['0,9', '0,10', '0,11', '0,12', '1,12', '2,13', '3,13', '3,14', '3,15', '3,16', '2,16', '2,15', '2,14', '1,13', '0,13'] },
      { color: 'YELLOW', direction: 'SE', cells: ['2,5', '1,5', '1,4', '1,3', '2,3', '3,2', '4,2', '5,2', '6,3', '7,3', '8,4', '9,4', '10,4', '11,3', '12,3', '13,2', '14,2', '15,2'] },
      { color: 'PINK', direction: 'E', cells: ['12,4', '13,3', '14,3', '15,3', '14,4', '15,4', '15,5'] },
      { color: 'PURPLE', direction: 'SW', cells: ['1,8', '2,8', '2,7', '1,7', '0,8', '0,7', '1,6', '2,6'] },
      { color: 'PURPLE', direction: 'SW', cells: ['4,3', '5,3', '6,4', '7,4', '8,5', '9,5', '10,5', '11,4'] },
      { color: 'PURPLE', direction: 'E', cells: ['13,13', '13,14', '13,15', '14,15', '14,14', '14,13', '14,12', '14,11', '14,10', '14,9', '14,8', '15,8', '15,9', '15,10', '15,11', '15,12', '15,13'] },
      { color: 'BLUE', direction: 'SW', cells: ['2,4', '3,3', '4,4', '3,4', '3,5', '4,5', '5,4', '6,5', '5,5', '4,6', '3,6', '3,7', '4,7'] },
      { color: 'BLUE', direction: 'NW', cells: ['13,4', '14,5', '14,6', '14,7', '13,7', '13,6', '13,5', '12,5', '11,5', '12,6', '12,7', '11,6'] },
      { color: 'GREEN', direction: 'NE', cells: ['1,9', '2,9', '3,8', '4,8', '4,9', '3,9'] },
      { color: 'GREEN', direction: 'NE', cells: ['4,15', '4,16', '5,16', '6,17', '7,17', '8,17', '9,17', '10,17', '11,16', '11,15', '11,14', '12,14', '12,15', '12,16', '12,17', '11,17'] },
      { color: 'PINK', direction: 'SW', cells: ['10,6', '9,6', '8,6', '7,5', '6,6', '5,6', '5,7', '5,8', '5,9', '4,10', '5,10', '6,10', '6,9', '6,8', '6,7', '7,6'] },
      { color: 'YELLOW', direction: 'SE', cells: ['3,11', '3,10', '2,11', '2,10', '1,10', '1,11', '2,12', '3,12', '4,13', '4,14', '5,14', '5,15', '6,16', '7,16'] },
      { color: 'BLUE', direction: 'NW', cells: ['7,14', '8,15', '9,15', '10,15', '10,16', '9,16', '8,16', '7,15', '6,15'] },
      { color: 'PURPLE', direction: 'W', cells: ['8,9', '8,8', '8,7', '7,7', '7,8', '7,9', '7,10', '6,11', '5,11', '4,12', '4,11'] },
      { color: 'YELLOW', direction: 'W', cells: ['12,8', '12,9', '12,10', '12,11', '12,12', '11,12', '10,13', '9,13', '8,14', '9,14', '10,14', '11,13', '12,13', '13,12', '13,11', '13,10', '13,9', '13,8'] },
      { color: 'GREEN', direction: 'SE', cells: ['11,11', '10,12', '9,12', '8,13', '7,13', '6,14', '5,13', '5,12', '6,13', '6,12', '7,12', '7,11', '8,12', '9,11', '8,11', '8,10', '9,10'] },
      { color: 'BLUE', direction: 'NW', cells: ['10,11', '11,10', '11,9', '10,10', '9,9', '10,9', '9,8'] },
      { color: 'GREEN', direction: 'SE', cells: ['9,7', '10,7', '11,7', '10,8', '11,8'] },
    ],
  },
  {
    name: 'Singularity',
    uuid: '5eed0000-0000-4000-8000-000000000014',
    difficulty: 'HARD',
    rows: 21,
    cols: 19,
    parTimeMs: 495000,
    arrows: [
      { color: 'BLUE', direction: 'W', cells: ['20,3', '20,2', '20,1', '20,0'] },
      { color: 'BLUE', direction: 'E', cells: ['0,8', '0,9', '0,10', '0,11', '0,12', '0,13', '0,14'] },
      { color: 'GREEN', direction: 'NE', cells: ['7,18', '8,18', '9,18', '10,18', '11,18', '11,17', '12,18', '13,18', '14,18', '15,18', '15,17', '16,18', '17,18', '18,18', '19,18', '20,18', '19,17', '20,17', '20,16', '19,16', '18,17', '17,17'] },
      { color: 'PURPLE', direction: 'NE', cells: ['17,0', '18,0', '19,0', '18,1', '19,1', '19,2', '18,2', '17,1', '17,2', '18,3', '19,3', '20,4', '20,5', '19,4', '18,5'] },
      { color: 'PURPLE', direction: 'E', cells: ['0,0', '0,1', '0,2', '0,3', '0,4', '0,5'] },
      { color: 'GREEN', direction: 'SW', cells: ['1,10', '1,9', '1,8', '1,7', '1,6', '0,7', '0,6', '1,5', '1,4', '1,3', '1,2', '1,1', '1,0', '2,0'] },
      { color: 'PINK', direction: 'SW', cells: ['2,3', '2,2', '2,1', '3,0', '4,0', '5,0', '6,1', '6,0', '7,0', '8,0'] },
      { color: 'PURPLE', direction: 'NE', cells: ['11,15', '12,16', '13,16', '14,17', '13,17', '12,17', '11,16', '10,16', '9,16', '10,17', '9,17', '8,17', '7,17', '6,18', '5,18'] },
      { color: 'BLUE', direction: 'SW', cells: ['20,14', '20,15', '19,15', '18,16', '17,15', '16,16', '15,16', '16,17', '17,16'] },
      { color: 'BLUE', direction: 'W', cells: ['2,4', '2,5', '2,6', '2,7', '2,8', '2,9', '2,10', '3,9', '3,8', '3,7', '3,6', '3,5', '3,4', '3,3'] },
      { color: 'YELLOW', direction: 'W', cells: ['4,2', '3,2', '3,1', '4,1', '5,1', '6,2', '7,1', '8,1', '9,0', '10,0', '11,0', '12,1', '12,0', '13,0', '14,0', '15,0', '16,1', '16,0'] },
      { color: 'PINK', direction: 'SE', cells: ['1,18', '0,18', '0,17', '0,16', '0,15', '1,15', '1,16', '1,17', '2,18', '3,18', '4,18', '3,17', '2,17', '2,16', '3,16'] },
      { color: 'BLUE', direction: 'SE', cells: ['6,16', '7,16', '6,17', '5,16', '4,17', '5,17'] },
      { color: 'PINK', direction: 'SW', cells: ['4,3', '5,2', '6,3', '5,3', '4,4', '4,5', '5,4', '6,4', '7,3', '7,2', '8,2'] },
      { color: 'YELLOW', direction: 'SE', cells: ['3,12', '2,12', '2,11', '1,11', '1,12', '2,13', '3,13', '4,14', '5,14', '5,15', '4,15', '3,14', '2,14', '1,13', '1,14', '2,15', '3,15', '4,16'] },
      { color: 'PURPLE', direction: 'SW', cells: ['9,1', '10,1', '11,1', '10,2', '9,2', '8,3', '8,4', '9,3'] },
      { color: 'BLUE', direction: 'NW', cells: ['18,4', '17,3', '16,4', '15,3', '14,3', '13,2', '12,2', '13,1', '14,2', '15,2', '16,3', '16,2', '15,1', '14,1'] },
      { color: 'GREEN', direction: 'SW', cells: ['3,10', '3,11', '4,12', '4,13', '5,13', '5,12', '5,11', '4,11', '4,10', '4,9', '4,8', '4,7', '4,6', '5,5', '6,5', '7,4', '7,5', '8,5', '9,4', '10,4', '10,3', '11,2'] },
      { color: 'PINK', direction: 'NW', cells: ['6,6', '5,6', '5,7', '5,8', '5,9', '5,10', '6,11', '6,12', '6,13', '6,14', '6,15', '7,15', '8,16', '9,15', '8,15'] },
      { color: 'YELLOW', direction: 'SE', cells: ['7,13', '7,14', '8,14', '9,13', '10,14', '9,14', '10,15', '11,14', '12,15', '13,15', '14,16'] },
      { color: 'GREEN', direction: 'NW', cells: ['17,4', '16,5', '15,4', '14,4'] },
      { color: 'PURPLE', direction: 'W', cells: ['8,8', '8,7', '8,6', '7,6', '7,7', '7,8', '7,9', '6,10', '6,9', '6,8', '6,7'] },
      { color: 'GREEN', direction: 'W', cells: ['10,12', '11,12', '12,13', '13,13', '14,14', '15,14', '16,15', '15,15', '14,15', '13,14', '12,14', '11,13', '10,13', '9,12', '8,12', '8,13', '7,12', '7,11', '7,10'] },
      { color: 'PINK', direction: 'E', cells: ['19,5', '20,6', '20,7', '20,8', '20,9', '20,10', '20,11', '20,12', '20,13'] },
      { color: 'PINK', direction: 'NE', cells: ['13,3', '12,3', '11,3', '12,4', '11,4'] },
      { color: 'YELLOW', direction: 'NE', cells: ['12,6', '13,5', '14,5', '13,4', '12,5', '11,5', '11,6', '10,7', '9,7', '9,6', '10,6', '10,5', '9,5'] },
      { color: 'PINK', direction: 'NW', cells: ['13,6', '12,7', '11,7', '10,8', '10,9', '10,10', '9,9', '9,8', '8,9', '8,10', '9,10', '10,11', '9,11', '8,11'] },
      { color: 'BLUE', direction: 'NW', cells: ['11,8', '12,8', '13,7', '14,7', '15,6', '14,6', '15,5', '16,6', '17,6', '18,7', '19,7', '19,6', '18,6', '17,5'] },
      { color: 'PURPLE', direction: 'SE', cells: ['11,9', '11,10', '11,11', '12,12', '12,11', '12,10', '12,9', '13,8', '14,8', '15,7', '16,7', '17,7', '16,8', '15,8', '14,9', '13,9', '13,10', '13,11', '13,12', '14,13'] },
      { color: 'PINK', direction: 'SE', cells: ['14,12', '14,11', '14,10', '15,9', '15,10', '15,11', '15,12', '15,13', '16,14', '17,14', '18,15'] },
      { color: 'GREEN', direction: 'E', cells: ['16,10', '16,11', '16,12', '16,13', '17,13', '18,14', '19,13', '19,14'] },
      { color: 'YELLOW', direction: 'SE', cells: ['16,9', '17,8', '18,8', '19,8', '18,9', '19,9'] },
      { color: 'PURPLE', direction: 'NW', cells: ['18,11', '19,10', '19,11', '18,12', '19,12', '18,13', '17,12', '17,11', '17,10', '18,10', '17,9'] },
    ],
  },
];

const solver = new BoardSolver();

/**
 * Build (and solver-verify) a showcase board. Cell contiguity is enforced
 * by ArrowPathInfo (hex-adjacency, odd-r) and overlap by BoardLayout, so a
 * typo in the tables above fails the seed instead of shipping a broken level.
 */
function buildShowcaseBoard(spec: ShowcaseSpec): BoardLayout {
  const arrows = spec.arrows.map(
    (a, i) => new ArrowPathInfo(`s${i}`, a.color, a.cells, a.direction),
  );
  const board = new BoardLayout({ rows: spec.rows, cols: spec.cols, arrows });
  if (!solver.isSolvable(board)) {
    throw new Error(`Showcase "${spec.name}" is not solvable`);
  }
  return board;
}

/**
 * Initial shop catalog. Canonical UUIDv4 ids so purchase DTOs that
 * validate @IsUUID('4') downstream accept them without a re-seed.
 */
const shopItems = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Neon Pink Theme',
    costCoins: 100,
    kind: 'COSMETIC',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Extra Life',
    costCoins: 50,
    kind: 'POWERUP',
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Hint Reveal',
    costCoins: 20,
    kind: 'POWERUP',
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();
  const repository = new PostgresLevelRepository(prisma);

  for (let index = 0; index < showcase.length; index++) {
    const spec = showcase[index];
    const board = buildShowcaseBoard(spec);
    const level = new Level({
      id: spec.uuid,
      index,
      difficulty: new HardProfile(),
      board,
      parTimeMs: spec.parTimeMs,
      published: true,
    });
    await repository.save(level);
    console.log(
      `Seeded index=${index} difficulty=HARD ` +
        `arrows=${board.arrows.length} showcase "${spec.name}" id=${spec.uuid}`,
    );
  }
  console.log(`Levels done. ${showcase.length} total (curated showcase).`);

  for (const item of shopItems) {
    await prisma.shopItem.upsert({
      where: { id: item.id },
      create: item,
      update: item,
    });
  }
  console.log(`Seeded ${shopItems.length} shop items.`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  throw error;
});
