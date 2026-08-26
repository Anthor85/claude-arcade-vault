"use client";

import { useState } from "react";
import styles from "./pokemon-counter.module.css";

const POKEMON_COUNT = 151;

export function PokemonCounter() {
  const [count, setCount] = useState(0);
  const [pokemonId, setPokemonId] = useState<number | null>(null);

  function handleClick() {
    setCount((c) => c + 1);
    setPokemonId(1 + Math.floor(Math.random() * POKEMON_COUNT));
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        onClick={handleClick}
        className={`${styles.counterBtn} pixel`}
      >
        ▲ CONTADOR: {count}
      </button>
      {pokemonId !== null && (
        <img
          key={pokemonId}
          src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`}
          alt={`Pokémon #${pokemonId}`}
          className={styles.sprite}
        />
      )}
    </div>
  );
}
