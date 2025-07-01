import React from "react";

export default function ProductList({ products, addToCart }) {
  return (
    <div className="product-list">
      {products.map((product) => (
        <div className="product" key={product.id}>
          <img src={product.image} alt={product.name} width={120} height={120} />
          <h3>{product.name}</h3>
          <p>${product.price}</p>
          <button onClick={() => addToCart(product)}>Add to Cart</button>
        </div>
      ))}
    </div>
  );
}
