import { Vector3 } from 'three';

export interface BivectorComponents {
  xy: number;
  yz: number;
  zx: number;
}

export class TensorCoordinate {
  constructor(
    public rgb: Vector3,
    public magnitude: number,
    public rank: number
  ) {}

  public static fromEuclidean(v: Vector3): TensorCoordinate {
    const magnitude = v.length();
    const rgb = v.clone().normalize().addScalar(1).multiplyScalar(0.5);
    const rank = Math.min(3, Math.floor(magnitude / 2) + 1);
    return new TensorCoordinate(rgb, magnitude, rank);
  }

  public toEuclidean(): Vector3 {
    return this.rgb.clone().multiplyScalar(2).subScalar(1).normalize().multiplyScalar(this.magnitude);
  }

  public translate(v: TensorCoordinate): TensorCoordinate {
    const p1 = this.toEuclidean();
    const p2 = v.toEuclidean();
    return TensorCoordinate.fromEuclidean(p1.add(p2));
  }

  public scale(s: number): TensorCoordinate {
    return new TensorCoordinate(this.rgb.clone(), this.magnitude * s, this.rank);
  }

  public normalize(): TensorCoordinate {
    return new TensorCoordinate(this.rgb.clone(), 1, this.rank);
  }

  public dotProduct(other: TensorCoordinate): number {
    return this.rgb.dot(other.rgb);
  }

  public geometricProduct(other: TensorCoordinate): { 
    grade: number; 
    result: TensorCoordinate; 
  } {
    const dot = this.dotProduct(other);
    const crossProduct = this.rgb.clone().cross(other.rgb);
    const resultVec = this.toEuclidean().add(other.toEuclidean()).add(crossProduct);
    
    return {
      grade: Math.abs(this.rank - other.rank) + dot,
      result: TensorCoordinate.fromEuclidean(resultVec)
    };
  }
}

export type TensorDirection = TensorCoordinate;
