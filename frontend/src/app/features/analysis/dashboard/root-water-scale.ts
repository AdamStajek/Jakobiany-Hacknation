import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { Report } from '../../../core/api/types';

@Component({
  selector: 'app-root-water-scale',
  imports: [DecimalPipe],
  templateUrl: './root-water-scale.html',
  host: {class: 'block'},
})
export class RootWaterScale {
  readonly root = input.required<NonNullable<Report['metrics']['root']>>();
  readonly conclusion = input.required<string>();
}
